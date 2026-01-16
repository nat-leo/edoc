// app/api/run/route.ts
// POST: create submission -> returns { token }
// GET : poll by token -> returns Judge0 submission payload

// python harness generator (LeetCode-style: class Solution: def <name>(self, ...))
// python harness generator (LeetCode-style: class Solution: def <name>(self, ...))
export function makePythonHarness(opts: {
  source_code: string;
  metadata: string; // LeetCode metaData JSON string
}) {
  const { source_code, metadata } = opts;

  return `# ---- USER CODE (verbatim) ----
${source_code}

# ---- HARNESS ----
import json

METADATA = ${JSON.stringify(metadata)}
md = json.loads(METADATA)

FUNC_NAME = md["name"]
PARAMS = [p["name"] for p in md.get("params", [])]

# hardcoded inputs for now
nums = [1, 2, 3, 4, 5, 6]
target = 9

def main():
    sol = Solution()

    args_by_name = {
        "nums": nums,
        "target": target,
    }
    args = [args_by_name[name] for name in PARAMS]

    result = getattr(sol, FUNC_NAME)(*args)
    print(json.dumps({"func": FUNC_NAME, "params": PARAMS, "args": args, "result": result}))

if __name__ == "__main__":
    main()
`;
}


const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

export async function POST(req: Request) {
  const body = await req.json();
  const { source_code, language_id, stdin, metadata } = body;

  const final_source_code =
    metadata ? makePythonHarness({ source_code, metadata }) : source_code;

  const url = new URL(`${BASE}/submissions`);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("wait", "false");
  url.searchParams.set("fields", "*");

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-rapidapi-key": KEY,
      "x-rapidapi-host": HOST,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_code: final_source_code, language_id, stdin: stdin ?? "" }),
  });

  return new Response(await r.text(), { status: r.status });
}


export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response('{"error":"Missing token"}', { status: 400 });

  const url = new URL(`${BASE}/submissions/${token}`);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("fields", "*");

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-key": KEY,
      "x-rapidapi-host": HOST,
      "Content-Type": "application/json",
    },
  });

  return new Response(await r.text(), { status: r.status });
}
