import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;
type PredictOutput = "prob" | "logit";
type PredictRequest = {
  series: number[];
  return_diagnostics: boolean;
  output: PredictOutput;
};
type ValidationResult =
  | { ok: true; value: PredictRequest }
  | { ok: false; error: string };

const ALLOWED_METHODS = ["GET", "POST"] as const;
const MAX_SERIES_LENGTH = 10000;
const MIN_SERIES_LENGTH = 2;
const MAX_SERIES_ABS_VALUE = 10 ** 12;

async function parseJsonBody(req: Request): Promise<JsonRecord | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as JsonRecord;
  } catch {
    return null;
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: ALLOWED_METHODS.join(", ") } }
  );
}

function getPredictUrl() {
  const baseUrl = process.env.GCP_BIG_O_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing GCP_BIG_O_BASE_URL");
  }
  return `${baseUrl.replace(/\/+$/, "")}/predict`;
}

function validatePredictRequest(body: JsonRecord): ValidationResult {
  const rawSeries = body.series;
  if (!Array.isArray(rawSeries)) {
    return { ok: false, error: "series must be an array of numbers" };
  }
  if (rawSeries.length < MIN_SERIES_LENGTH || rawSeries.length > MAX_SERIES_LENGTH) {
    return {
      ok: false,
      error: `series length must be between ${MIN_SERIES_LENGTH} and ${MAX_SERIES_LENGTH}`,
    };
  }

  const series: number[] = [];
  for (const raw of rawSeries) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) {
      return { ok: false, error: "series must contain only finite integers" };
    }
    if (Math.abs(raw) > MAX_SERIES_ABS_VALUE) {
      return { ok: false, error: `Series values too large (abs > ${MAX_SERIES_ABS_VALUE})` };
    }
    series.push(raw);
  }

  const returnDiagnostics =
    typeof body.return_diagnostics === "boolean" ? body.return_diagnostics : false;
  const output =
    body.output === "logit" || body.output === "prob"
      ? body.output
      : "prob";

  return {
    ok: true,
    value: {
      series,
      return_diagnostics: returnDiagnostics,
      output,
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());

  return NextResponse.json({
    resource: "big-o",
    action: "list",
    query,
    items: [],
  });
}

export async function POST(req: Request) {
  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validatePredictRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let predictUrl = "";
  try {
    predictUrl = getPredictUrl();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid Big O service configuration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const upstream = await fetch(predictUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.value),
      cache: "no-store",
    });

    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!upstream.ok) {
      let message = `Big O service request failed (${upstream.status})`;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const record = payload as JsonRecord;
        if (typeof record.detail === "string") message = record.detail;
        if (typeof record.error === "string") message = record.error;
      }

      return NextResponse.json(
        {
          error: message,
          upstreamStatus: upstream.status,
          upstream: payload,
        },
        { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    return NextResponse.json(
      { error: "Failed to reach Big O service", detail: message },
      { status: 502 }
    );
  }
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: ALLOWED_METHODS.join(", ") },
  });
}
