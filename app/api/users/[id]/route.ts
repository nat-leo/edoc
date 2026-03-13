export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

const COLLECTION = "users";
const ALLOWED_METHODS = ["GET", "PUT", "PATCH", "DELETE"] as const;

type JsonObject = Record<string, unknown>;

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: ALLOWED_METHODS.join(", ") } }
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function requireAuth() {
  const token = (await cookies()).get("__session")?.value;
  if (!token) {
    return null;
  }

  try {
    return await adminAuth.verifySessionCookie(token, true);
  } catch {
    return null;
  }
}

async function parseJsonObject(req: Request): Promise<JsonObject | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as JsonObject;
  } catch {
    return null;
  }
}

function sanitizeUserPayload(input: JsonObject): JsonObject {
  const payload: JsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    if (["id", "uid", "createdAt", "updatedAt", "createdBy"].includes(key)) {
      continue;
    }
    payload[key] = value;
  }

  return payload;
}

function normalizeId(value?: string | null) {
  const id = value?.trim();
  return id && id.length > 0 ? id : null;
}

function canAccessRecord(userUid: string, docId: string, data: JsonObject) {
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const uid = typeof data.uid === "string" ? data.uid : null;
  return userUid === docId || userUid === createdBy || userUid === uid;
}

async function getAuthorizedDoc(id: string, userUid: string) {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    return { status: "not_found" as const, ref, snap };
  }

  const data = (snap.data() ?? {}) as JsonObject;
  if (!canAccessRecord(userUid, id, data)) {
    return { status: "forbidden" as const, ref, snap, data };
  }

  return { status: "ok" as const, ref, snap, data };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const { id } = await params;
    const userId = normalizeId(id);
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const result = await getAuthorizedDoc(userId, user.uid);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return forbidden();
    }

    return NextResponse.json({ user: { id: result.ref.id, ...result.data } });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const { id } = await params;
    const userId = normalizeId(id);
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await getAuthorizedDoc(userId, user.uid);
    if (result.status === "forbidden") {
      return forbidden();
    }

    const now = new Date().toISOString();
    const payload = {
      ...sanitizeUserPayload(body),
      uid: user.uid,
      email: user.email ?? null,
      createdBy: user.uid,
      createdAt: result.status === "ok" ? result.data.createdAt ?? now : now,
      updatedAt: now,
    };

    await result.ref.set(payload, { merge: false });
    return NextResponse.json({ ok: true, id: result.ref.id }, { status: result.status === "ok" ? 200 : 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const { id } = await params;
    const userId = normalizeId(id);
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await getAuthorizedDoc(userId, user.uid);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return forbidden();
    }

    const payload = {
      ...sanitizeUserPayload(body),
      updatedAt: new Date().toISOString(),
    };

    await result.ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true, id: result.ref.id });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const { id } = await params;
    const userId = normalizeId(id);
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const result = await getAuthorizedDoc(userId, user.uid);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return forbidden();
    }

    await result.ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
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
