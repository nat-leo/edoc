// app/api/run/route.ts
// POST: create submission -> returns { token }
// GET : poll by token -> returns Judge0 submission payload

const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

export async function POST(req: Request) {
  const { source_code, language_id, stdin } = await req.json();

  const url = new URL(`${BASE}/submissions`);
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("wait", "false");     // return token quickly; UI polls
  url.searchParams.set("fields", "*");

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-rapidapi-key": KEY,
      "x-rapidapi-host": HOST,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_code, language_id, stdin: stdin ?? "" }),
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
