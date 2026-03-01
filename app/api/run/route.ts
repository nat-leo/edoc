// app/api/run/route.ts
// POST: create submission -> returns { token }
// GET : poll by token -> returns normalized Judge0 payload with parsed cases

import { makeJavaRunnerHarness, makeTypescriptRunnerHarness, makePythonRunnerHarness, parseNdjson, RunnerCase, RunResponse } from "@/lib/judge0";

const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

function assertEnv() {
  if (!BASE || !KEY || !HOST) {
    throw new Error("Missing RAPIDAPI env vars (RAPIDAPI_BASE_URL / RAPIDAPI_KEY / RAPIDAPI_HOST)");
  }
}

function parseMetaParamNames(metaData?: string | null): string[] {
  if (!metaData) return [];
  try {
    const md = JSON.parse(metaData);
    const params = Array.isArray(md?.params) ? md.params : [];
    return params.map((p: any) => p?.name).filter(Boolean);
  } catch {
    return [];
  }
}

function casesFromExampleTestcases(exampleTestcases: string | null | undefined, paramNames: string[]): RunnerCase[] {
  if (!exampleTestcases) return [];

  const names = paramNames.length ? paramNames : ["input"];
  const lines = exampleTestcases
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const arity = names.length || 1;
  const out: RunnerCase[] = [];

  for (let i = 0; i < lines.length; i += arity) {
    const chunk = lines.slice(i, i + arity);
    if (chunk.length < arity) break;

    const args: Record<string, string> = {};
    for (let j = 0; j < arity; j++) args[names[j]] = chunk[j];

    out.push({ i: out.length, args });
  }

  return out;
}

async function postToJudge0(payload: any) {
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
    body: JSON.stringify(payload),
  });

  return r;
}

async function pollFromJudge0(token: string) {
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

  return r;
}

export async function POST(req: Request) {
  try {
    assertEnv();

    const body = await req.json().catch(() => ({}));
    const { source_code, language_id, metaData, test_cases, cases_struct } = body;
    const langId = Number(language_id);

    if (!source_code) return new Response('{"error":"Missing source_code"}', { status: 400 });

    const paramOrder = parseMetaParamNames(typeof metaData === "string" ? metaData : undefined);
    const cases: RunnerCase[] =
      Array.isArray(cases_struct) && cases_struct.length > 0
        ? cases_struct
        : casesFromExampleTestcases(typeof test_cases === "string" ? test_cases : null, paramOrder);
    
    // pick the right test harness based on language_id:
    /**
     * Java        === 4
     * Python 3.13 === 109
     * Typescript  === 45
     */
    let final_source_code= String.raw`...`;
    console.log("Language ID and Type:", typeof language_id, language_id);
    switch (langId) {
      case 91:
        final_source_code = makeJavaRunnerHarness({
          source_code,
          metaData: typeof metaData === "string" ? metaData : null,
          cases,
          paramOrder,
        })
        break; // these breaks exist to stop the other cases from possibly triggering - we're setting, not returnig!

      case 101:
        final_source_code = makeTypescriptRunnerHarness({
          source_code,
          metaData: typeof metaData === "string" ? metaData : null,
          cases,
          paramOrder,
        })
        break; // these breaks exist to stop the other cases from possibly triggering - we're setting, not returnig!

      case 109:
        final_source_code = makePythonRunnerHarness({
          source_code,
          metaData: typeof metaData === "string" ? metaData : null,
          cases,
          paramOrder,
        });
        break; // these breaks exist to stop the other cases from possibly triggering - we're setting, not returnig!
      
      default:
        return new Response(JSON.stringify({ error: `Unsupported language_id: ${language_id}` }), { status: 400 });
    }
    console.log(final_source_code)

    const r = await postToJudge0({
      source_code: final_source_code,
      language_id: Number.isFinite(langId) ? langId : 32,
      stdin: "",
    });

    const text = await r.text();
    console.log(text)

    return new Response(text, { status: r.status, headers: { "Content-Type": "application/json" } });
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

    const r = await pollFromJudge0(token);
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
    
    console.log(out)

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
