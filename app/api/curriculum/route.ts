import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const ALLOWED_METHODS = ["GET"] as const;

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: ALLOWED_METHODS.join(", ") } }
  );
}

function toDisplayName(collectionId: string) {
  const base = collectionId.replace(/-curriculum$/i, "");
  if (!base) {
    return collectionId;
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function GET() {
  try {
    const collections = await adminDb.listCollections();
    const curriculumCollections = collections.filter((collection) =>
      collection.id.endsWith("-curriculum")
    );

    const items = await Promise.all(
      curriculumCollections.map(async (collection) => {
        const countSnap = await collection.count().get();
        const documentCount = countSnap.data().count;
        return {
          collection: collection.id,
          name: toDisplayName(collection.id),
          documentCount,
          totalProblems: documentCount,
        };
      })
    );

    items.sort((a, b) => a.collection.localeCompare(b.collection));

    return NextResponse.json({
      resource: "curriculum",
      action: "list",
      items,
    });
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

export async function POST() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: ALLOWED_METHODS.join(", ") },
  });
}
