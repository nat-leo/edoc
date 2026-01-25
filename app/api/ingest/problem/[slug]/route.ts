import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

type ProblemEntry = {
  title: string;
  titleSlug: string;
  content: string;          // HTML OR Markdown formatted as a String
  difficulty: "Easy" | "Medium" | "Hard" | string;
  starterCode?: Record<string, string>;
  metaData: string;         // ⚠️ usually JSON string
  exampleTestcases: string; // newline-delimited
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const ref = adminDb.collection("problem").doc(slug);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "Problem not found", titleSlug: slug },
        { status: 404 }
      );
    }

    const data = snap.data() as Partial<ProblemEntry> | undefined;
    if (!data) {
      return NextResponse.json(
        { error: "Problem data missing", titleSlug: slug },
        { status: 500 }
      );
    }

    const out: ProblemEntry = {
      title: data.title ?? "",
      titleSlug: data.titleSlug ?? slug,
      content: data.content ?? "",
      difficulty: data.difficulty ?? "Unknown",
      starterCode: data.starterCode ?? {},
      metaData: data.metaData ?? "",
      exampleTestcases: data.exampleTestcases ?? "",
    };

    return NextResponse.json({ problem: out });
  } catch (err: any) {
    console.error("Read problem error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
