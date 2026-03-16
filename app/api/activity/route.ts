export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { SUBMISSIONS_COLLECTION, SubmissionRecord } from "@/lib/submissions";

const ALLOWED_METHODS = ["GET"] as const;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ActivityMetric = "submissions" | "logins";
type GroupBy = "day";

type ActivityRequest = {
  userUuid: string;
  from: string;
  to: string;
  metrics: ActivityMetric[];
  groupBy: GroupBy;
};

type ActivityDay = {
  date: string;
  submissions: number;
  logins: number;
};

type SubmissionDoc = Partial<SubmissionRecord> & Record<string, unknown>;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: ALLOWED_METHODS.join(", ") } }
  );
}

async function requireAuth() {
  const token = (await cookies()).get("__session")?.value;
  if (!token) return null;

  try {
    return await adminAuth.verifySessionCookie(token, true);
  } catch {
    return null;
  }
}

function toYmdUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseYmdUtc(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (toYmdUtc(parsed) !== value) return null;
  return parsed;
}

function normalizeRange(fromRaw: string | null, toRaw: string | null) {
  const today = new Date();
  const toDefault = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const fromDefault = new Date(toDefault.getTime() - 364 * ONE_DAY_MS);

  const from = parseYmdUtc(fromRaw) ?? fromDefault;
  const to = parseYmdUtc(toRaw) ?? toDefault;
  if (from.getTime() > to.getTime()) return null;

  return {
    from,
    to,
    fromYmd: toYmdUtc(from),
    toYmd: toYmdUtc(to),
  };
}

function normalizeMetrics(raw: string | null): ActivityMetric[] {
  if (!raw) return ["submissions", "logins"];

  const parsed = raw
    .split(",")
    .map((metric) => metric.trim())
    .filter((metric): metric is ActivityMetric => metric === "submissions" || metric === "logins");

  if (parsed.length === 0) return ["submissions", "logins"];
  return Array.from(new Set(parsed));
}

function readSubmissionDateKey(data: SubmissionDoc): string | null {
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : null;
  const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : null;
  const iso = createdAt ?? updatedAt;
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return toYmdUtc(date);
}

function buildActivityDaysBySubmissionCount(input: {
  docs: SubmissionDoc[];
  fromYmd: string;
  toYmd: string;
}): ActivityDay[] {
  const submissionsByDay = new Map<string, number>();

  for (const doc of input.docs) {
    const day = readSubmissionDateKey(doc);
    if (!day) continue;
    if (day < input.fromYmd || day > input.toYmd) continue;
    submissionsByDay.set(day, (submissionsByDay.get(day) ?? 0) + 1);
  }

  return Array.from(submissionsByDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, submissions]) => ({
      date,
      submissions,
      logins: 0,
    }));
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    if (!user) return unauthorized();

    const url = new URL(req.url);
    const userUuid = url.searchParams.get("userUuid")?.trim() ?? "";
    if (!userUuid) {
      return NextResponse.json({ error: "Missing userUuid" }, { status: 400 });
    }
    if (userUuid !== user.uid) return forbidden();

    const groupBy = url.searchParams.get("groupBy")?.trim() ?? "day";
    if (groupBy !== "day") {
      return NextResponse.json({ error: "Only groupBy=day is supported" }, { status: 400 });
    }

    const range = normalizeRange(url.searchParams.get("from"), url.searchParams.get("to"));
    if (!range) {
      return NextResponse.json({ error: "Invalid date range. 'from' must be <= 'to'." }, { status: 400 });
    }

    const metrics = normalizeMetrics(url.searchParams.get("metrics"));
    const snap = await adminDb
      .collection(SUBMISSIONS_COLLECTION)
      .where("userId", "==", userUuid)
      .get();

    const docs = snap.docs.map((doc) => doc.data() as SubmissionDoc);
    const days = buildActivityDaysBySubmissionCount({
      docs,
      fromYmd: range.fromYmd,
      toYmd: range.toYmd,
    });

    const requestPayload: ActivityRequest = {
      userUuid,
      from: range.fromYmd,
      to: range.toYmd,
      metrics,
      groupBy: "day",
    };

    return NextResponse.json({
      request: requestPayload,
      days,
    });
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
