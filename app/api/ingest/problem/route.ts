import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

type ProblemEntry = {
  title: string;
  titleSlug: string;
  content: string;          // HTML string
  difficulty: "Easy" | "Medium" | "Hard" | string;
  starterCode?: Record<string, string>;
  metaData: string;         // ⚠️ usually JSON string
  exampleTestcases: string; // newline-delimited
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProblemEntry;

    if (!body?.titleSlug) {
      return NextResponse.json({ error: "Missing titleSlug" }, { status: 400 });
    }
    if (body.content == null) {
      return NextResponse.json({ error: "Missing problem content" }, { status: 400 });
    }

    const docId = body.titleSlug;
    const ref = adminDb.collection("problem").doc(docId);
    await ref.set(
      {
        title: body.title,
        titleSlug: body.titleSlug,
        content: body.content,
        difficulty: body.difficulty,
        starterCode: body.starterCode,
        metaData: body.metaData,
        exampleTestcases: body.exampleTestcases,
        updatedAt: new Date().toISOString(),
      },
      { merge: true } // upsert behavior
    );

    console.log("Ingest problem:", body.titleSlug);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
