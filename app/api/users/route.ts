export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

const COLLECTION = "users";
const ALLOWED_METHODS = ["GET", "POST"] as const;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

type JsonObject = Record<string, unknown>;

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: ALLOWED_METHODS.join(", ") } }
  );
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (["id", "createdAt", "updatedAt", "createdBy"].includes(key)) {
      continue;
    }
    payload[key] = value;
  }

  return payload;
}

function normalizeLimit(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const url = new URL(req.url);
    const limit = normalizeLimit(url.searchParams.get("limit"));
    const cursor = url.searchParams.get("cursor")?.trim() ?? "";

    let query = adminDb
      .collection(COLLECTION)
      .where("createdBy", "==", user.uid)
      .limit(limit);

    if (cursor) {
      const cursorDoc = await adminDb.collection(COLLECTION).doc(cursor).get();
      if (!cursorDoc.exists) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      query = query.startAfter(cursorDoc);
    }

    const snap = await query.get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      resource: "users",
      action: "list",
      count: items.length,
      items,
      nextCursor: snap.docs.length === limit ? snap.docs[snap.docs.length - 1]?.id ?? null : null,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    if (!user) {
      return unauthorized();
    }

    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const requestedId = typeof body.id === "string" ? body.id.trim() : "";
    if (requestedId && requestedId !== user.uid) {
      return forbidden();
    }

    const now = new Date().toISOString();
    const payload = {
      ...sanitizeUserPayload(body),
      uid: user.uid,
      email: user.email ?? null,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const ref = requestedId
      ? adminDb.collection(COLLECTION).doc(requestedId)
      : adminDb.collection(COLLECTION).doc();

    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    await ref.set(payload, { merge: false });
    return NextResponse.json({ ok: true, id: ref.id }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
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
