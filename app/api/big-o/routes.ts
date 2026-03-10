/**
 * 
 * 
 * 
 */

import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

const ALLOWED_METHODS = ["GET", "POST"] as const;

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

  return NextResponse.json(
    {
      resource: "big-o",
      action: "create",
      item: body,
    },
    { status: 201 }
  );
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
