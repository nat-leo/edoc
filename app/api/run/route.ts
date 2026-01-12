// app/api/about/route.ts

export async function POST(req: Request) {
  const url = `${process.env.RAPIDAPI_BASE_URL}/submissions?base64_encoded=false&wait=true&fields=*`;
  const { source_code, language_id, stdin } = await req.json();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language_id: language_id,
        source_code: source_code,
        stdin: stdin
      })
    });
    const result = await response.text();
    return new Response(result);
  } catch (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }
}

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);
  const our_token = searchParams.get("token");
  const code_run_url = `${process.env.RAPIDAPI_BASE_URL}/submissions/${our_token}?base64_encoded=false`;

  try {
    const response = await fetch(code_run_url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST,
        'Content-Type': 'application/json'
      }
    });
    return new Response(await response.text(), { status: response.status });
  } catch (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }
}

