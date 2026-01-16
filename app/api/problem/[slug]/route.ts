import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

const PROBLEMS_PATH = path.join(process.cwd(), "app/api/problem/problems.json");

type ProblemEntry = {
  question: {
    titleSlug: string;
    [key: string]: unknown;
  };
};

type ProblemsFile = {
  data: ProblemEntry[];
};

function normalizeSlug(slug?: string | string[] | null) {
  if (!slug) return "";
  if (Array.isArray(slug)) {
    return slug.join("/");
  }
  return slug;
}

export async function GET(
  req: Request,
  {
    params,
  }: {
    params?: Promise<{
      slug?: string | string[];
    }>;
  }
) {
  const resolvedParams = await params;
  const rawData = await readFile(PROBLEMS_PATH, "utf-8");
  const parsed = JSON.parse(rawData) as ProblemsFile;
  const candidates = Array.isArray(parsed?.data) ? parsed.data : [];

  const url = new URL(req.url);
  const slugFromRoute = normalizeSlug(resolvedParams?.slug);
  const slugFromUrl = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const slug = slugFromRoute || slugFromUrl;

  const normalized = slug.toLowerCase();

  const match = candidates.find(
    (entry) =>
      typeof entry.question?.titleSlug === "string" &&
      entry.question.titleSlug.toLowerCase() === normalized
  );

  if (!match) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  return NextResponse.json(match);
}
