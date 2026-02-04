// app/api/submit/route.ts
// POST: create submission from hidden tests -> returns { token, meta }
// GET : poll by token -> returns Judge0 submission payload (stdout/stderr/status/time/memory)

import { adminDb } from "@/lib/firebase-admin";

const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

type HiddenTest = {
  n: number;
  args: Record<string, any>;
};

function assertEnv() {
  if (!BASE || !KEY || !HOST) {
    throw new Error("Missing RAPIDAPI env vars (RAPIDAPI_BASE_URL / RAPIDAPI_KEY / RAPIDAPI_HOST)");
  }
}

function makePythonHarnessFromHiddenTests(opts: {
  source_code: string;
  funcName?: string; // optional, we can infer from metadata if you later add it
  tests: HiddenTest[];
  paramOrder: string[];
}) {
  const { source_code, tests, paramOrder } = opts;

  // Embed tests + param order as JSON strings to avoid Python repr issues
  const TESTS_JSON = JSON.stringify(tests);
  const ORDER_JSON = JSON.stringify(paramOrder);

  return `
  
# ---- USER CODE (verbatim) ----
from typing import List

${source_code}

# ---- HARNESS (hidden tests) ----
import json
import time
import traceback
import tracemalloc

TESTS = json.loads(${JSON.stringify(TESTS_JSON)})
PARAM_ORDER = json.loads(${JSON.stringify(ORDER_JSON)})

def _to_positional(args_by_name):
    # Build positional args in the exact paramOrder
    return [args_by_name[name] for name in PARAM_ORDER]

def main():
    # Expect user code defines: class Solution
    sol = Solution()

    # Try to infer the method name:
    # - If Solution has only one public method (not starting with "_"), use it.
    # - Otherwise you should pass metadata/funcName later; for now we do best effort.
    public = [k for k in dir(sol) if not k.startswith("_") and callable(getattr(sol, k))]
    if len(public) == 1:
        func_name = public[0]
    else:
        # Ambiguous. Give a helpful error.
        raise Exception("Ambiguous Solution methods: " + ", ".join(public) + ". Provide metadata/func name.")

    fn = getattr(sol, func_name)

    for i, t in enumerate(TESTS):
        n = t.get("n")
        args_by_name = t.get("args", {})

        # Emit a marker BEFORE running, so crashes can be tied to a case index.
        # print(json.dumps({"type": "CASE_START", "i": i, "n": n}), flush=True)

        args = _to_positional(args_by_name)

        # Per-test measurement (Python side)
        tracemalloc.start()
        t0 = time.perf_counter()
        result = fn(*args)
        dt_ms = (time.perf_counter() - t0) * 1000.0
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # One JSON line per test
        print(json.dumps({
            "n": n,
            "runtime_ms": dt_ms,
            "mb": peak,
        }), flush=True)

if __name__ == "__main__":
    main()
`;
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

    // Load hidden tests
    const snap = await adminDb.collection("generated_problems").doc(slug).get();
    if (!snap.exists) return new Response('{"error":"Problem not found"}', { status: 404 });

    const data = snap.data() ?? {};
    const tests = data.tests as HiddenTest[] | undefined;
    const paramOrder = data.paramOrder as string[] | undefined;

    if (!Array.isArray(tests) || tests.length === 0) {
      return new Response('{"error":"No hidden tests found"}', { status: 400 });
    }
    if (!Array.isArray(paramOrder) || paramOrder.length === 0) {
      return new Response('{"error":"Missing paramOrder in problem doc"}', { status: 400 });
    }

    // Build harness that runs hidden tests
    const final_source_code = makePythonHarnessFromHiddenTests({
      source_code,
      tests,
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
        // stdout will contain CASE_START/CASE_RESULT lines
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

    return new Response(await r.text(), { status: r.status });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
