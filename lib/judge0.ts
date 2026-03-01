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
  
/** USER CODE (verbatim) */
${source_code}

/** HARNESS (runner) */
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

main();` 
 
export function makeJavaRunnerHarness(opts: {
  source_code: string;
  metaData?: string | null;
  cases: RunnerCase[];
  paramOrder?: string[];
}) {
  const { source_code, metaData, cases, paramOrder } = opts;

  const METADATA_RAW = JSON.stringify(metaData ?? "null");
  const CASES_RAW = JSON.stringify(JSON.stringify(cases));
  const PARAM_ORDER_RAW = JSON.stringify(JSON.stringify(paramOrder ?? []));
  return String.raw`
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Array;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

// ---- USER CODE (verbatim) ----
${source_code}

// ---- HARNESS (runner) ----
public class Main {
    static final String METADATA_RAW = ${METADATA_RAW};
    static final String CASES_RAW = ${CASES_RAW};
    static final String PARAM_ORDER_RAW = ${PARAM_ORDER_RAW};

    static class Json {
        static Object parse(String s) {
            int[] i = new int[] { 0 };
            Object v = parseValue(s, i);
            skipWs(s, i);
            if (i[0] != s.length()) throw new RuntimeException("Trailing JSON content");
            return v;
        }

        static Object tryParse(String s) {
            try {
                return parse(s);
            } catch (Exception e) {
                return s;
            }
        }

        static String stringify(Object v) {
            if (v == null) return "null";
            if (v instanceof String) return quote((String) v);
            if (v instanceof Number) {
                if (v instanceof Double && !Double.isFinite((Double) v)) return quote(String.valueOf(v));
                if (v instanceof Float && !Float.isFinite((Float) v)) return quote(String.valueOf(v));
                return String.valueOf(v);
            }
            if (v instanceof Boolean) return String.valueOf(v);
            if (v instanceof Map) {
                StringBuilder sb = new StringBuilder();
                sb.append("{");
                boolean first = true;
                for (Object eObj : ((Map<?, ?>) v).entrySet()) {
                    Map.Entry<?, ?> e = (Map.Entry<?, ?>) eObj;
                    if (!first) sb.append(",");
                    first = false;
                    sb.append(quote(String.valueOf(e.getKey()))).append(":").append(stringify(e.getValue()));
                }
                sb.append("}");
                return sb.toString();
            }
            if (v instanceof Iterable) {
                StringBuilder sb = new StringBuilder();
                sb.append("[");
                boolean first = true;
                for (Object item : (Iterable<?>) v) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append(stringify(item));
                }
                sb.append("]");
                return sb.toString();
            }
            Class<?> c = v.getClass();
            if (c.isArray()) {
                StringBuilder sb = new StringBuilder();
                sb.append("[");
                int n = Array.getLength(v);
                for (int idx = 0; idx < n; idx++) {
                    if (idx > 0) sb.append(",");
                    sb.append(stringify(Array.get(v, idx)));
                }
                sb.append("]");
                return sb.toString();
            }
            return quote(String.valueOf(v));
        }

        static String quote(String s) {
            StringBuilder sb = new StringBuilder();
            sb.append('"');
            for (int j = 0; j < s.length(); j++) {
                char ch = s.charAt(j);
                switch (ch) {
                    case '"':
                        sb.append("\\\"");
                        break;
                    case '\\':
                        sb.append("\\\\");
                        break;
                    case '\b':
                        sb.append("\\b");
                        break;
                    case '\f':
                        sb.append("\\f");
                        break;
                    case '\n':
                        sb.append("\\n");
                        break;
                    case '\r':
                        sb.append("\\r");
                        break;
                    case '\t':
                        sb.append("\\t");
                        break;
                    default:
                        if (ch < 0x20) {
                            sb.append(String.format("\\u%04x", (int) ch));
                        } else {
                            sb.append(ch);
                        }
                }
            }
            sb.append('"');
            return sb.toString();
        }

        static Object parseValue(String s, int[] i) {
            skipWs(s, i);
            if (i[0] >= s.length()) throw new RuntimeException("Unexpected end of JSON");
            char ch = s.charAt(i[0]);
            if (ch == '"') return parseString(s, i);
            if (ch == '{') return parseObject(s, i);
            if (ch == '[') return parseArray(s, i);
            if (ch == 't' && s.startsWith("true", i[0])) {
                i[0] += 4;
                return Boolean.TRUE;
            }
            if (ch == 'f' && s.startsWith("false", i[0])) {
                i[0] += 5;
                return Boolean.FALSE;
            }
            if (ch == 'n' && s.startsWith("null", i[0])) {
                i[0] += 4;
                return null;
            }
            return parseNumber(s, i);
        }

        static String parseString(String s, int[] i) {
            if (s.charAt(i[0]) != '"') throw new RuntimeException("Expected quote");
            i[0]++;
            StringBuilder sb = new StringBuilder();
            while (i[0] < s.length()) {
                char ch = s.charAt(i[0]++);
                if (ch == '"') return sb.toString();
                if (ch == '\\') {
                    if (i[0] >= s.length()) throw new RuntimeException("Bad escape");
                    char esc = s.charAt(i[0]++);
                    switch (esc) {
                        case '"':
                            sb.append('"');
                            break;
                        case '\\':
                            sb.append('\\');
                            break;
                        case '/':
                            sb.append('/');
                            break;
                        case 'b':
                            sb.append('\b');
                            break;
                        case 'f':
                            sb.append('\f');
                            break;
                        case 'n':
                            sb.append('\n');
                            break;
                        case 'r':
                            sb.append('\r');
                            break;
                        case 't':
                            sb.append('\t');
                            break;
                        case 'u':
                            if (i[0] + 4 > s.length()) throw new RuntimeException("Bad unicode escape");
                            String hex = s.substring(i[0], i[0] + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            i[0] += 4;
                            break;
                        default:
                            throw new RuntimeException("Bad escape: " + esc);
                    }
                } else {
                    sb.append(ch);
                }
            }
            throw new RuntimeException("Unterminated string");
        }

        static Map<String, Object> parseObject(String s, int[] i) {
            Map<String, Object> m = new LinkedHashMap<>();
            i[0]++; // {
            skipWs(s, i);
            if (i[0] < s.length() && s.charAt(i[0]) == '}') {
                i[0]++;
                return m;
            }
            while (true) {
                skipWs(s, i);
                String key = parseString(s, i);
                skipWs(s, i);
                if (i[0] >= s.length() || s.charAt(i[0]) != ':') throw new RuntimeException("Expected ':'");
                i[0]++;
                Object val = parseValue(s, i);
                m.put(key, val);
                skipWs(s, i);
                if (i[0] >= s.length()) throw new RuntimeException("Unexpected end in object");
                char ch = s.charAt(i[0]++);
                if (ch == '}') break;
                if (ch != ',') throw new RuntimeException("Expected ',' or '}'");
            }
            return m;
        }

        static List<Object> parseArray(String s, int[] i) {
            List<Object> out = new ArrayList<>();
            i[0]++; // [
            skipWs(s, i);
            if (i[0] < s.length() && s.charAt(i[0]) == ']') {
                i[0]++;
                return out;
            }
            while (true) {
                out.add(parseValue(s, i));
                skipWs(s, i);
                if (i[0] >= s.length()) throw new RuntimeException("Unexpected end in array");
                char ch = s.charAt(i[0]++);
                if (ch == ']') break;
                if (ch != ',') throw new RuntimeException("Expected ',' or ']'");
            }
            return out;
        }

        static Number parseNumber(String s, int[] i) {
            int start = i[0];
            if (s.charAt(i[0]) == '-') i[0]++;
            while (i[0] < s.length() && Character.isDigit(s.charAt(i[0]))) i[0]++;
            boolean hasFrac = false;
            if (i[0] < s.length() && s.charAt(i[0]) == '.') {
                hasFrac = true;
                i[0]++;
                while (i[0] < s.length() && Character.isDigit(s.charAt(i[0]))) i[0]++;
            }
            if (i[0] < s.length()) {
                char ch = s.charAt(i[0]);
                if (ch == 'e' || ch == 'E') {
                    hasFrac = true;
                    i[0]++;
                    if (i[0] < s.length() && (s.charAt(i[0]) == '+' || s.charAt(i[0]) == '-')) i[0]++;
                    while (i[0] < s.length() && Character.isDigit(s.charAt(i[0]))) i[0]++;
                }
            }
            String num = s.substring(start, i[0]);
            return hasFrac ? Double.valueOf(num) : Long.valueOf(num);
        }

        static void skipWs(String s, int[] i) {
            while (i[0] < s.length() && Character.isWhitespace(s.charAt(i[0]))) i[0]++;
        }
    }

    static Method inferMethod() {
        String name = null;
        try {
            Object mdObj = !"null".equals(METADATA_RAW) ? Json.parse(METADATA_RAW) : null;
            if (mdObj instanceof Map) {
                Object v = ((Map<?, ?>) mdObj).get("name");
                if (v != null) name = String.valueOf(v);
            }
        } catch (Exception ignored) {}

        List<Method> candidates = new ArrayList<>();
        for (Method m : Solution.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(m.getModifiers())) continue;
            if (m.isSynthetic()) continue;
            if (name != null && !name.equals(m.getName())) continue;
            candidates.add(m);
        }

        if (candidates.isEmpty()) {
            throw new RuntimeException(name != null ? "No public Solution method named: " + name : "No public Solution methods found");
        }
        if (candidates.size() == 1) return candidates.get(0);

        List<String> names = new ArrayList<>();
        for (Method m : candidates) names.add(m.getName());
        throw new RuntimeException("Ambiguous Solution methods: " + String.join(", ", names));
    }

    static Object coerce(Object v) {
        if (v instanceof String) return Json.tryParse(((String) v).trim());
        return v;
    }

    static List<Object> argsList(Map<String, Object> argsByName, List<String> paramOrder) {
        List<Object> out = new ArrayList<>();
        if (paramOrder != null && !paramOrder.isEmpty()) {
            for (String name : paramOrder) out.add(coerce(argsByName.get(name)));
            return out;
        }
        List<String> keys = new ArrayList<>(argsByName.keySet());
        Collections.sort(keys);
        for (String k : keys) out.add(coerce(argsByName.get(k)));
        return out;
    }

    static Object convertArg(Object raw, Class<?> target) {
        if (raw == null) {
            if (!target.isPrimitive()) return null;
            if (target == boolean.class) return false;
            if (target == char.class) return '\0';
            if (target == byte.class) return (byte) 0;
            if (target == short.class) return (short) 0;
            if (target == int.class) return 0;
            if (target == long.class) return 0L;
            if (target == float.class) return 0f;
            if (target == double.class) return 0d;
            return null;
        }

        if (target == Object.class) return raw;

        if (target == String.class) return String.valueOf(raw);

        if (target == boolean.class || target == Boolean.class) {
            if (raw instanceof Boolean) return raw;
            return Boolean.parseBoolean(String.valueOf(raw));
        }

        if (target == char.class || target == Character.class) {
            String s = String.valueOf(raw);
            return s.isEmpty() ? '\0' : s.charAt(0);
        }

        if (target == byte.class || target == Byte.class) return ((Number) toNumber(raw)).byteValue();
        if (target == short.class || target == Short.class) return ((Number) toNumber(raw)).shortValue();
        if (target == int.class || target == Integer.class) return ((Number) toNumber(raw)).intValue();
        if (target == long.class || target == Long.class) return ((Number) toNumber(raw)).longValue();
        if (target == float.class || target == Float.class) return ((Number) toNumber(raw)).floatValue();
        if (target == double.class || target == Double.class) return ((Number) toNumber(raw)).doubleValue();

        if (target.isArray()) {
            Class<?> comp = target.getComponentType();
            if (!(raw instanceof List)) return raw;
            List<?> list = (List<?>) raw;
            Object arr = Array.newInstance(comp, list.size());
            for (int i = 0; i < list.size(); i++) {
                Array.set(arr, i, convertArg(list.get(i), comp));
            }
            return arr;
        }

        if (List.class.isAssignableFrom(target) && raw instanceof List) return raw;
        if (Map.class.isAssignableFrom(target) && raw instanceof Map) return raw;

        return raw;
    }

    static Number toNumber(Object raw) {
        if (raw instanceof Number) return (Number) raw;
        String s = String.valueOf(raw);
        if (s.contains(".") || s.contains("e") || s.contains("E")) return Double.valueOf(s);
        return Long.valueOf(s);
    }

    static Object invoke(Method m, Object target, List<Object> args) throws Exception {
        Class<?>[] types = m.getParameterTypes();
        Object[] converted = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            Object raw = i < args.size() ? args.get(i) : null;
            converted[i] = convertArg(raw, types[i]);
        }
        return m.invoke(target, converted);
    }

    static boolean deepEquals(Object a, Object b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        if (a instanceof Number && b instanceof Number) {
            return Double.compare(((Number) a).doubleValue(), ((Number) b).doubleValue()) == 0;
        }
        if (a.getClass().isArray() && b.getClass().isArray()) {
            int na = Array.getLength(a), nb = Array.getLength(b);
            if (na != nb) return false;
            for (int i = 0; i < na; i++) {
                if (!deepEquals(Array.get(a, i), Array.get(b, i))) return false;
            }
            return true;
        }
        if (a instanceof List && b instanceof List) {
            List<?> la = (List<?>) a;
            List<?> lb = (List<?>) b;
            if (la.size() != lb.size()) return false;
            for (int i = 0; i < la.size(); i++) {
                if (!deepEquals(la.get(i), lb.get(i))) return false;
            }
            return true;
        }
        if (a instanceof Map && b instanceof Map) {
            Map<?, ?> ma = (Map<?, ?>) a;
            Map<?, ?> mb = (Map<?, ?>) b;
            if (ma.size() != mb.size()) return false;
            for (Map.Entry<?, ?> e : ma.entrySet()) {
                Object k = e.getKey();
                if (!mb.containsKey(k)) return false;
                if (!deepEquals(e.getValue(), mb.get(k))) return false;
            }
            return true;
        }
        return Objects.equals(a, b);
    }

    static Object jsonable(Object v) {
        try {
            Json.stringify(v);
            return v;
        } catch (Exception e) {
            return String.valueOf(v);
        }
    }

    static long usedBytes() {
        Runtime rt = Runtime.getRuntime();
        return rt.totalMemory() - rt.freeMemory();
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        Object casesObj = Json.parse(CASES_RAW);
        Object orderObj = Json.parse(PARAM_ORDER_RAW);
        List<String> paramOrder = new ArrayList<>();
        if (orderObj instanceof List) {
            for (Object o : (List<Object>) orderObj) paramOrder.add(String.valueOf(o));
        }

        if (!(casesObj instanceof List)) throw new RuntimeException("CASES must be a JSON array");
        List<Object> cases = (List<Object>) casesObj;

        Solution sol = new Solution();
        Method fn = inferMethod();
        fn.setAccessible(true);

        for (int idx = 0; idx < cases.size(); idx++) {
            Map<String, Object> c = (cases.get(idx) instanceof Map)
                ? (Map<String, Object>) cases.get(idx)
                : new LinkedHashMap<String, Object>();

            int i = c.get("i") instanceof Number ? ((Number) c.get("i")).intValue() : idx;
            Number n = c.get("n") instanceof Number ? (Number) c.get("n") : null;
            boolean hasExpected = c.containsKey("expected");
            Object expected = c.get("expected");

            Map<String, Object> argsRaw = (c.get("args") instanceof Map)
                ? (Map<String, Object>) c.get("args")
                : new LinkedHashMap<String, Object>();

            Map<String, Object> argsByName = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : argsRaw.entrySet()) argsByName.put(e.getKey(), coerce(e.getValue()));
            List<Object> argList = argsList(argsByName, paramOrder);

            try {
                long mem0 = usedBytes();
                long t0 = System.nanoTime();
                Object result = invoke(fn, sol, argList);
                double dtMs = (System.nanoTime() - t0) / 1_000_000.0;
                long mem1 = usedBytes();
                long peak = Math.max(0L, mem1 - mem0);

                Boolean matches = null;
                if (hasExpected && expected != null) {
                    matches = deepEquals(result, expected);
                }

                Map<String, Object> out = new LinkedHashMap<>();
                out.put("type", "CASE");
                out.put("i", i);
                out.put("n", n);
                out.put("args", argsByName);
                out.put("result", jsonable(result));
                out.put("expected", jsonable(expected));
                out.put("matches", matches);
                out.put("runtime_ms", dtMs);
                out.put("mb", peak);
                System.out.println(Json.stringify(out));
            } catch (Throwable e) {
                StringWriter sw = new StringWriter();
                e.printStackTrace(new PrintWriter(sw));

                Map<String, Object> out = new LinkedHashMap<>();
                out.put("type", "CASE");
                out.put("i", i);
                out.put("n", n);
                out.put("args", argsByName);
                out.put("error", String.valueOf(e));
                out.put("trace", sw.toString());
                System.out.println(Json.stringify(out));
            }
        }
    }
}
`;
}
