// Shared Judge0 helpers: harness generation + NDJSON parsing
// Keep lightweight so it can be imported in both server routes and client code.

export type JudgeCaseResult = {
  i: number;
  args: Record<string, any>;
  result?: any;
  expected?: any;
  matches?: boolean | null;
  runtime_ms?: number;
  mb?: number;
  error?: string;
  trace?: string;
  n?: number;
};

export type RunResponse = {
  token?: string;
  status?: { id: number; description?: string };
  stdout_raw: string;
  stderr_raw: string;
  cases: JudgeCaseResult[];
  compile_output?: string | null;
  time?: string | null;
  memory?: string | null;
  unparsed_lines?: string[];
};

export type CaseBadge = "idle" | "running" | "pass" | "fail" | "error" | "ran";

export type RunnerCase = {
  i?: number;
  n?: number;
  args: Record<string, any>;
  expected?: any;
};

export function badgeFromCase(c: JudgeCaseResult): CaseBadge {
  if (c.error) return "error";
  if (c.matches === true) return "pass";
  if (c.matches === false) return "fail";
  if (c.matches === null || typeof c.matches === "undefined") return "ran";
  return "ran";
}

export function parseNdjson(stdoutRaw: string | null | undefined): {
  cases: JudgeCaseResult[];
  unparsed_lines: string[];
} {
  if (!stdoutRaw) return { cases: [], unparsed_lines: [] };

  const cases: JudgeCaseResult[] = [];
  const unparsed: string[] = [];

  const lines = stdoutRaw.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && obj.type === "CASE") {
        const { i = cases.length, args = {}, result, expected, matches, runtime_ms, mb, error, trace, n } = obj;
        cases.push({ i, args, result, expected, matches, runtime_ms, mb, error, trace, n });
      } else {
        unparsed.push(line);
      }
    } catch {
      unparsed.push(line);
    }
  }

  return { cases, unparsed_lines: unparsed };
}

export function makePythonRunnerHarness(opts: {
  source_code: string;
  metaData?: string | null;
  cases: RunnerCase[];
  paramOrder?: string[];
}) {
  const { source_code, metaData, cases, paramOrder } = opts;

  const METADATA_RAW = JSON.stringify(metaData ?? "null");
  const CASES_RAW = JSON.stringify(JSON.stringify(cases));
  const PARAM_ORDER_RAW = JSON.stringify(JSON.stringify(paramOrder ?? []));

  return `
# ---- USER CODE (verbatim) ----
from typing import List

${source_code}

# ---- HARNESS (runner) ----
import json
import time
import tracemalloc
import traceback

METADATA_RAW = ${METADATA_RAW}
PARAM_ORDER = json.loads(${PARAM_ORDER_RAW}) if ${paramOrder && paramOrder.length ? "True" : "False"} else []
CASES = json.loads(${CASES_RAW})


def _infer_func(sol):
    try:
        md = json.loads(METADATA_RAW) if METADATA_RAW not in (None, "null") else {}
    except Exception:
        md = {}
    name = md.get("name") if isinstance(md, dict) else None
    if name:
        return name
    public = [k for k in dir(sol) if not k.startswith("_") and callable(getattr(sol, k))]
    public = [k for k in public if k != "__class__"]
    if len(public) == 1:
        return public[0]
    raise Exception("Ambiguous Solution methods: " + ", ".join(public))


def _coerce(v):
    if isinstance(v, str):
        txt = v.strip()
        try:
            return json.loads(txt)
        except Exception:
            return v
    return v


def _args_list(args_by_name):
    if PARAM_ORDER:
        return [_coerce(args_by_name.get(name)) for name in PARAM_ORDER]
    return [_coerce(args_by_name[k]) for k in sorted(args_by_name.keys())]


def _jsonable(val):
    try:
        json.dumps(val)
        return val
    except TypeError:
        return repr(val)


def main():
    sol = Solution()
    func_name = _infer_func(sol)
    fn = getattr(sol, func_name)

    for idx, case in enumerate(CASES):
        i = case.get("i", idx)
        args_raw = case.get("args", {}) or {}
        args_by_name = {k: _coerce(v) for k, v in args_raw.items()}
        args = _args_list(args_by_name)
        expected = case.get("expected", None)
        n = case.get("n")

        try:
            tracemalloc.start()
            t0 = time.perf_counter()
            result = fn(*args)
            dt_ms = (time.perf_counter() - t0) * 1000.0
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            matches = None
            if "expected" in case and expected is not None:
                matches = result == expected

            print(json.dumps({
                "type": "CASE",
                "i": i,
                "n": n,
                "args": args_by_name,
                "result": _jsonable(result),
                "expected": _jsonable(expected),
                "matches": matches,
                "runtime_ms": dt_ms,
                "mb": peak,
            }), flush=True)
        except Exception as e:
            tracemalloc.stop()
            print(json.dumps({
                "type": "CASE",
                "i": i,
                "n": n,
                "args": args_by_name,
                "error": repr(e),
                "trace": traceback.format_exc(),
            }), flush=True)


if __name__ == "__main__":
    main()
`;
}

export function makeTypescriptRunnerHarness(opts: {
  source_code: string;
  metaData?: string | null;
  cases: RunnerCase[];
  paramOrder?: string[];
}) {
  const { source_code, metaData, cases, paramOrder } = opts;

  const METADATA_RAW = JSON.stringify(metaData ?? "null");
  const CASES_RAW = JSON.stringify(JSON.stringify(cases));
  const PARAM_ORDER_RAW = JSON.stringify(JSON.stringify(paramOrder ?? []));

  return `
// ---- USER CODE (verbatim) ----
${source_code}

// ---- HARNESS (runner) ----
import { performance } from "perf_hooks";

const METADATA_RAW = ${METADATA_RAW};
const PARAM_ORDER = ${paramOrder && paramOrder.length ? `JSON.parse(${PARAM_ORDER_RAW})` : "[]"};
const CASES = JSON.parse(${CASES_RAW});

function _parseMeta(): any {
  if (METADATA_RAW === null || METADATA_RAW === "null") return {};
  try {
    const parsed = JSON.parse(METADATA_RAW);
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed);
      } catch {
        return parsed;
      }
    }
    return parsed ?? {};
  } catch {
    return {};
  }
}

function _exports(): any {
  if (typeof module !== "undefined" && module.exports) return module.exports;
  if (typeof exports !== "undefined") return exports;
  return {};
}

function _inferFuncName(): string {
  const md = _parseMeta();
  const name = md && typeof md === "object" ? md.name : undefined;
  if (name) return String(name);

  const exp = _exports();
  const publicFns = Object.keys(exp).filter((k) => typeof exp[k] === "function");
  if (publicFns.length === 1) return publicFns[0];

  throw new Error("Ambiguous Solution functions: " + publicFns.join(", "));
}

function _tryEval(name: string): any {
  try {
    // Direct eval keeps local scope so function declarations are visible.
    return eval(name);
  } catch {
    return (globalThis as any)[name];
  }
}

function _getFn(name: string): any {
  const exp = _exports();
  if (name && typeof exp[name] === "function") return exp[name];
  return _tryEval(name);
}

function _coerce(v: any): any {
  if (typeof v === "string") {
    const txt = v.trim();
    try {
      return JSON.parse(txt);
    } catch {
      return v;
    }
  }
  return v;
}

function _argsList(argsByName: Record<string, any>): any[] {
  if (Array.isArray(PARAM_ORDER) && PARAM_ORDER.length) {
    return PARAM_ORDER.map((name: string) => _coerce(argsByName[name]));
  }
  return Object.keys(argsByName)
    .sort()
    .map((k) => _coerce(argsByName[k]));
}

function _jsonable(val: any): any {
  if (typeof val === "undefined") return null;
  try {
    JSON.stringify(val);
    return val;
  } catch {
    return String(val);
  }
}

function _deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    const aIsArray = Array.isArray(a);
    const bIsArray = Array.isArray(b);
    if (aIsArray !== bIsArray) return false;

    if (aIsArray) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!_deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
      const key = aKeys[i];
      if (!_deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

async function main() {
  const funcName = _inferFuncName();
  const fn = _getFn(funcName);
  if (typeof fn !== "function") throw new Error("Function not found: " + funcName);

  for (let idx = 0; idx < CASES.length; idx++) {
    const c = CASES[idx] ?? {};
    const i = typeof c.i !== "undefined" ? c.i : idx;
    const argsRaw = c.args ?? {};
    const argsByName: Record<string, any> = {};
    for (const k of Object.keys(argsRaw)) argsByName[k] = _coerce(argsRaw[k]);
    const args = _argsList(argsByName);
    const expected = c.expected ?? null;
    const n = c.n;

    try {
      const mem0 = process.memoryUsage().heapUsed;
      const t0 = performance.now();
      const result = await fn(...args);
      const dtMs = performance.now() - t0;
      const mem1 = process.memoryUsage().heapUsed;
      const peak = Math.max(mem0, mem1);

      let matches: boolean | null = null;
      if ("expected" in c && expected !== null) {
        matches = _deepEqual(result, expected);
      }

      console.log(
        JSON.stringify({
          type: "CASE",
          i,
          n,
          args: argsByName,
          result: _jsonable(result),
          expected: _jsonable(expected),
          matches,
          runtime_ms: dtMs,
          mb: peak,
        })
      );
    } catch (e: any) {
      console.log(
        JSON.stringify({
          type: "CASE",
          i,
          n,
          args: argsByName,
          error: e?.toString?.() ?? String(e),
          trace: e?.stack ?? "",
        })
      );
    }
  }
}

main();
`;
}
