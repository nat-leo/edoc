// app/api/languages/route.ts
const BASE = process.env.RAPIDAPI_BASE_URL!;
const KEY = process.env.RAPIDAPI_KEY!;
const HOST = process.env.RAPIDAPI_HOST!;

export async function GET() {
  const r = await fetch(`${BASE}/languages`, {
    headers: {
      "x-rapidapi-key": KEY,
      "x-rapidapi-host": HOST,
    },
  });

  return new Response(await r.text(), { status: r.status });
}
