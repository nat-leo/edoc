import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const UPDATABLE_FIELDS = [
  "title",
  "content",
  "difficulty",
  "starterCode",
  "metaData",
  "exampleTestcases",
  "paramOrder",
  "tests",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

type HiddenTest = {
  n: number;
  args: Record<string, any>;
  solutionOutput?: unknown;
};

function normalizeTests(value: unknown): HiddenTest[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, HiddenTest>);
    entries.sort((a, b) => {
      const na = Number(a[0]);
      const nb = Number(b[0]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return na - nb;
      }
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([, test]) => test);
  }
  return undefined;
}

type ProblemEntry = {
  title: string;
  titleSlug: string;
  content: string;
  difficulty: string;
  starterCode: Record<string, string>;
  metaData: string;
  exampleTestcases: string;
  paramOrder?: string[];
  tests?: HiddenTest[];
  createdAt?: string;
  updatedAt?: string;
};

function getCollectionFromCategory(value?: string | null) {
  const category = value?.trim();
  if (!category) {
    return null;
  }

  const firstWord = category.split(/[\s_-]+/)[0]?.toLowerCase();
  if (!firstWord) {
    return null;
  }

  return `${firstWord}-curriculum`;
}

function normalizeSlug(value?: string | null) {
  const slug = value?.trim();
  return slug && slug.length > 0 ? slug : null;
}

async function parseBody(req: Request): Promise<Partial<ProblemEntry> | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Partial<ProblemEntry>;
  } catch {
    return null;
  }
}

function buildProblemEntry(data: Partial<ProblemEntry> | undefined, slug: string): ProblemEntry {
  const payload = data ?? {};
  return {
    title: payload.title ?? "",
    titleSlug: payload.titleSlug ?? slug,
    content: payload.content ?? "",
    difficulty: payload.difficulty ?? "Unknown",
    starterCode: payload.starterCode ?? {},
    metaData: payload.metaData ?? "",
    exampleTestcases: payload.exampleTestcases ?? "",
    paramOrder: payload.paramOrder,
    tests: normalizeTests(payload.tests),
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function buildPayload(
  body: Partial<ProblemEntry>,
  slug: string,
  opts: { includeCreatedAt: boolean; withDefaults: boolean }
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    titleSlug: slug,
    updatedAt: now,
  };
  if (opts.includeCreatedAt) {
    payload.createdAt = now;
  }

  const setField = (field: keyof ProblemEntry, defaultValue?: unknown) => {
    const value = body[field];
    if (value !== undefined) {
      payload[field] = value;
    } else if (opts.withDefaults && defaultValue !== undefined) {
      payload[field] = defaultValue;
    }
  };

  setField("title", slug);
  setField("content", "");
  setField("difficulty", "Unknown");
  setField("starterCode", {});
  setField("metaData", "");
  setField("exampleTestcases", "");
  setField("paramOrder");
  setField("tests");

  return payload;
}

function hasUpdatableField(body: Partial<ProblemEntry>) {
  return UPDATABLE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const slugValue = normalizeSlug(category);
    if (!slugValue) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    const collection = getCollectionFromCategory(slugValue);
    if (!collection) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const ref = adminDb.collection(collection).doc(slugValue);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    const out = buildProblemEntry(snap.data(), slugValue);
    return NextResponse.json({ problem: out });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

function validateTitleAndContent(body: Partial<ProblemEntry>) {
  const titleValue = typeof body.title === "string" ? body.title.trim() : "";
  if (!titleValue) {
    return { error: "Missing or empty title" };
  }

  const contentValue = typeof body.content === "string" ? body.content : "";
  if (!contentValue.trim()) {
    return { error: "Missing or empty content" };
  }

  return { title: titleValue, content: contentValue };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const slugValue = normalizeSlug(category);
    if (!slugValue) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    const collection = getCollectionFromCategory(slugValue);
    if (!collection) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const body = await parseBody(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const titleCheck = validateTitleAndContent(body);
    if ("error" in titleCheck) {
      return NextResponse.json({ error: titleCheck.error }, { status: 400 });
    }

    const ref = adminDb.collection(collection).doc(slugValue);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ error: "Problem already exists" }, { status: 409 });
    }

    const sanitized: Partial<ProblemEntry> = {
      ...body,
      title: titleCheck.title,
      content: titleCheck.content,
    };

    const payload = buildPayload(sanitized, slugValue, { includeCreatedAt: true, withDefaults: true });
    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const slugValue = normalizeSlug(category);
    if (!slugValue) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    const collection = getCollectionFromCategory(slugValue);
    if (!collection) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const body = await parseBody(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const titleCheck = validateTitleAndContent(body);
    if ("error" in titleCheck) {
      return NextResponse.json({ error: titleCheck.error }, { status: 400 });
    }

    const sanitized: Partial<ProblemEntry> = {
      ...body,
      title: titleCheck.title,
      content: titleCheck.content,
    };

    const ref = adminDb.collection(collection).doc(slugValue);
    const doc = await ref.get();
    const isNew = !doc.exists;
    const payload = buildPayload(sanitized, slugValue, {
      includeCreatedAt: isNew,
      withDefaults: isNew,
    });

    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true }, { status: isNew ? 201 : 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const slugValue = normalizeSlug(category);
    if (!slugValue) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    const collection = getCollectionFromCategory(slugValue);
    if (!collection) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const body = await parseBody(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!hasUpdatableField(body)) {
      return NextResponse.json(
        {
          error:
            "Provide at least one updatable field (title, content, difficulty, starterCode, metaData, exampleTestcases, paramOrder)",
        },
        { status: 400 }
      );
    }

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
      }
      body.title = body.title.trim();
    }

    if (body.content !== undefined) {
      if (typeof body.content !== "string" || !body.content.trim()) {
        return NextResponse.json({ error: "Content must be a non-empty string" }, { status: 400 });
      }
    }

    if (body.difficulty !== undefined && typeof body.difficulty !== "string") {
      return NextResponse.json({ error: "Difficulty must be a string" }, { status: 400 });
    }

    if (body.metaData !== undefined && typeof body.metaData !== "string") {
      return NextResponse.json({ error: "metaData must be a string" }, { status: 400 });
    }

    if (body.exampleTestcases !== undefined && typeof body.exampleTestcases !== "string") {
      return NextResponse.json({ error: "exampleTestcases must be a string" }, { status: 400 });
    }

    if (body.paramOrder !== undefined) {
      if (!Array.isArray(body.paramOrder) || body.paramOrder.some((item) => typeof item !== "string")) {
        return NextResponse.json({ error: "paramOrder must be an array of strings" }, { status: 400 });
      }
    }

    if (body.starterCode !== undefined && (body.starterCode === null || typeof body.starterCode !== "object")) {
      return NextResponse.json({ error: "starterCode must be an object" }, { status: 400 });
    }

    const ref = adminDb.collection(collection).doc(slugValue);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    const payload = buildPayload(body, slugValue, { includeCreatedAt: false, withDefaults: false });
    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const slugValue = normalizeSlug(category);
    if (!slugValue) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }

    const collection = getCollectionFromCategory(slugValue);
    if (!collection) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const ref = adminDb.collection(collection).doc(slugValue);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
