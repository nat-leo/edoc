/**
 * 
 * 
 * 
 */

import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;
type RouteParams = { category: string };

const ALLOWED_METHODS = ["GET", "PUT", "PATCH", "DELETE"] as const;

function getCategorySlug(value: string) {
  const slug = value.trim();
  return slug.length > 0 ? slug : null;
}

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

async function readCategory(params: Promise<RouteParams>) {
  const resolvedParams = await params;
  const category = getCategorySlug(resolvedParams.category);
  if (!category) {
    return null;
  }
  return category;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const category = await readCategory(params);
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  return NextResponse.json({
    resource: "curriculum",
    action: "get",
    category,
    item: null,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const category = await readCategory(params);
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({
    resource: "curriculum",
    action: "replace",
    category,
    item: body,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const category = await readCategory(params);
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json({
    resource: "curriculum",
    action: "update",
    category,
    changes: body,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const category = await readCategory(params);
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  return NextResponse.json({
    resource: "curriculum",
    action: "delete",
    category,
  });
}

export async function POST() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: ALLOWED_METHODS.join(", ") },
  });
}
