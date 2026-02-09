// app/api/submit/route.ts
// POST: create submission from hidden tests -> returns { token, meta }
// GET : poll by token -> returns normalized Judge0 payload with parsed cases

import { makePythonRunnerHarness, parseNdjson, RunResponse, RunnerCase } from "@/lib/judge0";

const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

type HiddenTest = {
  n: number;
  args: Record<string, any>;
  solutionOutput?: unknown;
};

function assertEnv() {
  if (!BASE || !KEY || !HOST) {
    throw new Error("Missing RAPIDAPI env vars (RAPIDAPI_BASE_URL / RAPIDAPI_KEY / RAPIDAPI_HOST)");
  }
}

export async function POST(req: Request) {
  try {
    assertEnv();

    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug ?? "");
    const source_code = String(body?.source_code ?? "");
    const language_id = Number(body?.language_id ?? 32); // keep consistent with your current usage

    if (!slug) return new Response('{"error":"Missing slug"}', { status: 400 });
    if (!source_code) return new Response('{"error":"Missing source_code"}', { status: 400 });

    const origin = new URL(req.url).origin;
    const problemRes = await fetch(`${origin}/api/problems/${slug}`, { cache: "no-store" });
    const problemPayload = await problemRes.json().catch(() => ({} as any));

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

    const final_source_code = makePythonRunnerHarness({
      source_code,
      metaData: problem.metaData ?? null,
      cases: runnerCases,
      paramOrder,
    });

    // Submit to Judge0 (same pattern as /api/run)
    const url = new URL(`${BASE}/submissions`);
    url.searchParams.set("base64_encoded", "false");
    url.searchParams.set("wait", "false");
    url.searchParams.set("fields", "stdout,stderr,status,time,memory");

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

    // Judge0 returns JSON; we’ll merge in meta safely without assuming shape
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    const out = {
      ...payload,
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
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req: Request) {
  try {
    assertEnv();

    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response('{"error":"Missing token"}', { status: 400 });

    const url = new URL(`${BASE}/submissions/${token}`);
    url.searchParams.set("base64_encoded", "false");
    url.searchParams.set("fields", "stdout,stderr,status,time,memory");

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": KEY,
        "x-rapidapi-host": HOST,
        "Content-Type": "application/json",
      },
    });

    const text = await r.text();

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    const stdout_raw = String(payload?.stdout ?? "");
    const stderr_raw = String(
      payload?.stderr ?? payload?.compile_output ?? payload?.message ?? ""
    );

    const { cases, unparsed_lines } = parseNdjson(stdout_raw);

    const out: RunResponse = {
      token,
      status: payload?.status,
      stdout_raw,
      stderr_raw,
      cases,
      compile_output: payload?.compile_output ?? null,
      time: payload?.time ?? null,
      memory: payload?.memory ?? null,
      unparsed_lines,
    };

    return new Response(JSON.stringify(out), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
