// app/api/submit/route.ts
// POST: create submission from hidden tests -> returns { token, meta }
// GET : poll by token -> returns normalized Judge0 payload with parsed cases

import { cookies } from "next/headers";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { makePythonRunnerHarness, makeTypescriptRunnerHarness, parseNdjson, RunResponse, RunnerCase } from "@/lib/judge0";
import { JUDGE0_LANGUAGE_ID } from "@/lib/starter-code";
import {
  buildSubmissionRecord,
  isTerminalSubmissionStatus,
  mapJudge0StatusToSubmissionStatus,
  SUBMISSIONS_COLLECTION,
  SubmissionRecord,
  SubmissionStatus,
} from "@/lib/submissions";

const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

function unauthorized() {
  return new Response('{"error":"Unauthorized"}', {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAuth() {
  const token = (await cookies()).get("__session")?.value;
  if (!token) return null;

  try {
    return await adminAuth.verifySessionCookie(token, true);
  } catch (err) {
    console.error("Auth verification failed", err);
    return null;
  }
}

type HiddenTest = {
  n: number;
  args: Record<string, unknown>;
  solutionOutput?: unknown;
};

type Judge0Payload = Record<string, unknown>;
type ProblemApiPayload = {
  problem?: Record<string, unknown>;
  [key: string]: unknown;
};

function assertEnv() {
  if (!BASE || !KEY || !HOST) {
    throw new Error("Missing RAPIDAPI env vars (RAPIDAPI_BASE_URL / RAPIDAPI_KEY / RAPIDAPI_HOST)");
  }
}

function slugFromReferer(referer: string | null) {
  if (!referer) return null;
  try {
    const path = new URL(referer).pathname;
    const match = path.match(/^\/problems\/([^/]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeSubmissionId(value: string | null) {
  const id = value?.trim();
  return id && id.length > 0 ? id : null;
}

function parseJudge0Payload(text: string): Judge0Payload {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Judge0Payload;
    }
    return { value: parsed };
  } catch {
    return { raw: text };
  }
}

function readNullableString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstNonEmpty(values: Array<string | null>): string {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function readJudge0Status(input: unknown): { id?: number; description?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const status = input as Record<string, unknown>;
  return {
    id: typeof status.id === "number" ? status.id : undefined,
    description: typeof status.description === "string" ? status.description : undefined,
  };
}

async function resolveSubmissionRefForUser(input: {
  submissionId: string | null;
  judge0Token: string;
  userId: string;
}) {
  if (input.submissionId) {
    const ref = adminDb.collection(SUBMISSIONS_COLLECTION).doc(input.submissionId);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const data = snap.data() as Partial<SubmissionRecord> | undefined;
    if (!data || data.userId !== input.userId || data.judge0Token !== input.judge0Token) {
      return null;
    }
    return ref;
  }

  const snap = await adminDb
    .collection(SUBMISSIONS_COLLECTION)
    .where("judge0Token", "==", input.judge0Token)
    .limit(5)
    .get();

  const match = snap.docs.find((doc) => {
    const data = doc.data() as Partial<SubmissionRecord> | undefined;
    return data?.userId === input.userId;
  });

  return match?.ref ?? null;
}

async function persistSubmissionUpdate(input: {
  submissionId: string | null;
  judge0Token: string;
  userId: string;
  status: SubmissionStatus;
  judge0Payload: Judge0Payload;
}) {
  try {
    const ref = await resolveSubmissionRefForUser({
      submissionId: input.submissionId,
      judge0Token: input.judge0Token,
      userId: input.userId,
    });
    if (!ref) return;

    const payload: Partial<SubmissionRecord> = {
      status: input.status,
      updatedAt: new Date().toISOString(),
    };

    if (isTerminalSubmissionStatus(input.status)) {
      payload.judge0Response = input.judge0Payload;
    }

    await ref.set(payload, { merge: true });
  } catch (error) {
    console.error("[/api/submit] Failed to persist submission update", {
      submissionId: input.submissionId,
      judge0Token: input.judge0Token,
      userId: input.userId,
      error,
    });
  }
}

export async function POST(req: Request) {
  try {
    assertEnv();

    const user = await requireAuth();
    if (!user) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "");
    const source_code = String(body?.source_code ?? "");
    const language_id = Number(body?.language_id ?? 0); // keep consistent with your current usage

    if (!slug) return new Response('{"error":"Missing slug"}', { status: 400 });
    if (!source_code) return new Response('{"error":"Missing source_code"}', { status: 400 });

    const origin = new URL(req.url).origin;
    const problemRes = await fetch(`${origin}/api/problems/${slug}`, { cache: "no-store" });
    const problemPayload = (await problemRes.json().catch(() => ({}))) as ProblemApiPayload;

    if (!problemRes.ok) {
      return new Response(JSON.stringify(problemPayload), {
        status: problemRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const problem = problemPayload?.problem;
    if (!problem) {
      return new Response('{"error":"Problem payload missing"}', {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tests = problem.tests as HiddenTest[] | undefined;
    const paramOrder = problem.paramOrder as string[] | undefined;

    if (!Array.isArray(tests) || tests.length === 0) {
      return new Response('{"error":"No hidden tests found"}', {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(paramOrder) || paramOrder.length === 0) {
      return new Response('{"error":"Missing paramOrder in problem doc"}', {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build harness that runs hidden tests
    const runnerCases: RunnerCase[] = tests.map((t) => ({
      n: t.n,
      args: t.args ?? {},
      expected: typeof t.solutionOutput === "undefined" ? null : t.solutionOutput,
    }));

    const makeHarness =
      Number(language_id) === JUDGE0_LANGUAGE_ID.typescript
        ? makeTypescriptRunnerHarness
        : makePythonRunnerHarness;

    const final_source_code = makeHarness({
      source_code,
      metaData: problem.metaData ?? null,
      cases: runnerCases,
      paramOrder,
    });

    // Submit to Judge0 (same pattern as /api/run)
    const url = new URL(`${BASE}/submissions`);
    url.searchParams.set("base64_encoded", "false");
    url.searchParams.set("wait", "false");
    url.searchParams.set("fields", "token,status_id");

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "x-rapidapi-key": KEY,
        "x-rapidapi-host": HOST,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: final_source_code,
        language_id,
        stdin: "",
      }),
    });

    // Include a small bit of metadata so the UI knows how to interpret stdout
    const text = await r.text();
    if (!r.ok) return new Response(text, { status: r.status });

    const payload = parseJudge0Payload(text);
    const judge0Token = typeof payload.token === "string" ? payload.token : "";
    if (!judge0Token) {
      return new Response('{"error":"Judge0 did not return a token"}', {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const initialStatus =
      typeof payload.status_id === "number"
        ? mapJudge0StatusToSubmissionStatus({ id: payload.status_id })
        : "queued";

    const submissionRef = adminDb.collection(SUBMISSIONS_COLLECTION).doc();
    const submissionRecord = buildSubmissionRecord({
      id: submissionRef.id,
      judge0Token,
      userId: user.uid,
      problemId: slug,
      languageId: language_id,
      code: source_code,
      status: initialStatus,
    });
    await submissionRef.set(submissionRecord, { merge: false });

    const out = {
      ...payload,
      id: submissionRef.id,
      submissionId: submissionRef.id,
      judge0Token,
      submissionStatus: submissionRecord.status,
      meta: {
        slug,
        testCount: tests.length,
        paramOrder,
        stdoutFormat: "jsonl",
      },
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: messageFromError(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req: Request) {
  try {
    assertEnv();

    const user = await requireAuth();
    if (!user) return unauthorized();

    const requestUrl = new URL(req.url);
    const token = requestUrl.searchParams.get("token");
    const submissionId = normalizeSubmissionId(requestUrl.searchParams.get("submissionId"));
    const referer = req.headers.get("referer");
    const slugFromQuery = requestUrl.searchParams.get("slug");
    const slug = slugFromQuery?.trim() || slugFromReferer(referer);

    console.info("[/api/submit][GET] Incoming request", {
      method: req.method,
      path: requestUrl.pathname,
      token,
      submissionId,
      slug,
      userId: user.uid ?? null,
      userAgent: req.headers.get("user-agent"),
      forwardedFor: req.headers.get("x-forwarded-for"),
      referer,
    });

    if (!token) return new Response('{"error":"Missing token"}', { status: 400 });

    const url = new URL(`${BASE}/submissions/${token}`);
    url.searchParams.set("base64_encoded", "false");
    url.searchParams.set("fields", "stdout,stderr,compile_output,message,status,time,memory");

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": KEY,
        "x-rapidapi-host": HOST,
        "Content-Type": "application/json",
      },
    });

    const text = await r.text();

    const payload = parseJudge0Payload(text);
    const judge0Status = readJudge0Status(payload.status);
    const submissionStatus = mapJudge0StatusToSubmissionStatus(judge0Status);
    await persistSubmissionUpdate({
      submissionId,
      judge0Token: token,
      userId: user.uid,
      status: submissionStatus,
      judge0Payload: payload,
    });

    const stdout_raw = readNullableString(payload.stdout) ?? "";
    const compileOutput = readNullableString(payload.compile_output);
    const stderr_raw = firstNonEmpty([
      readNullableString(payload.stderr),
      compileOutput,
      readNullableString(payload.message),
    ]);

    const { cases, unparsed_lines } = parseNdjson(stdout_raw);
    const status = typeof judge0Status.id === "number"
      ? { id: judge0Status.id, description: judge0Status.description }
      : undefined;

    const out: RunResponse = {
      token,
      status,
      stdout_raw,
      stderr_raw,
      cases,
      compile_output: compileOutput,
      time: readNullableString(payload.time),
      memory: readNullableString(payload.memory),
      unparsed_lines,
    };

    console.info("[/api/submit][GET] Judge0 response", {
      token,
      slug,
      userId: user.uid ?? null,
      judge0HttpStatus: r.status,
      judge0Status: status ?? null,
      submissionStatus,
      time: readNullableString(payload.time),
      memory: readNullableString(payload.memory),
      caseCount: Array.isArray(cases) ? cases.length : 0,
      unparsedLineCount: Array.isArray(unparsed_lines) ? unparsed_lines.length : 0,
      hasCompileOutput: Boolean(compileOutput),
      stderrPreview: stderr_raw.slice(0, 300),
      stdoutPreview: stdout_raw.slice(0, 300),
    });

    return new Response(JSON.stringify(out), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: messageFromError(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
