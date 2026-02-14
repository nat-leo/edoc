export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { adminApp, adminDb } from "@/lib/firebase-admin";

const COLLECTION = "generated_problems";

type ProblemListItem = {
  title?: string;
  titleSlug?: string;
  difficulty?: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.has("debug");

    const snap = await adminDb.collection(COLLECTION).get();

    const problems: ProblemListItem[] = snap.docs.map((doc) => ({
      title: doc.get("title") ?? "Title Not Found",
      titleSlug: doc.get("titleSlug") ?? doc.id,
      difficulty: doc.get("difficulty") ?? "Difficulty Not Found",
    }));

    const payload: Record<string, unknown> = { problems, count: snap.size };
    if (debug) {
      payload.debug = {
        projectId: adminApp.options.projectId,
        collection: COLLECTION,
        docIds: snap.docs.map((d) => d.id),
      };
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Problem list error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
