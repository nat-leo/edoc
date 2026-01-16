import { NextResponse } from "next/server";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const SUPPORTED = [
  { slug: "typescript", lc: "typescript", judge0LanguageId: 74 },
  { slug: "python", lc: "python3", judge0LanguageId: 71 },
  { slug: "java", lc: "java", judge0LanguageId: 62 },
] as const;

type CanonType = "int" | "int[]" | "int[][]" | "string" | "string[]" | "boolean" | "void";

function canonTypeFromLeetCode(t: string): CanonType {
  // minimal mapping; extend when you hit more types
  const s = t.trim().toLowerCase();
  if (s === "integer") return "int";
  if (s === "integer[]") return "int[]";
  if (s === "integer[][]") return "int[][]";
  if (s === "string") return "string";
  if (s === "string[]") return "string[]";
  if (s === "boolean") return "boolean";
  return "void"; // fallback
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            title
            titleSlug
            content
            difficulty
            codeSnippets { langSlug code }
            metaData
            exampleTestcases
          }
        }
      `,
      variables: { titleSlug: slug },
    }),
    cache: "no-store",
  });

  const json = await res.json();
  const q = json?.data?.question;
  if (!q) {
    return NextResponse.json({ error: "LeetCode question not found", raw: json }, { status: 404 });
  }

  // signature from metaData (JSON string)
  let signature = undefined as any;
  try {
    const md = JSON.parse(q.metaData);
    signature = {
      functionName: md.name,
      params: (md.params ?? []).map((p: any) => ({
        name: p.name,
        type: canonTypeFromLeetCode(p.type),
      })),
      returnType: canonTypeFromLeetCode(md.return?.type ?? "void"),
    };
  } catch {
    signature = undefined;
  }

  // starter code from codeSnippets
  const starterCode: Record<string, string> = {};
  for (const s of SUPPORTED) {
    const snippet = (q.codeSnippets ?? []).find((x: any) => x.langSlug === s.lc);
    if (snippet?.code) starterCode[s.slug] = snippet.code;
  }

  const out = {
    title: q.title,
    titleSlug: q.titleSlug,
    difficulty: q.difficulty,
    content: q.content, // HTML; your UI already supports HTML rendering
    metadata: q.metaData,
    signature,
    supportedLanguages: SUPPORTED.map((s) => ({
      slug: s.slug,
      judge0LanguageId: s.judge0LanguageId,
    })),
    starterCode,
    // examples: (optional) you can wire later from exampleTestcases/content parsing
  };

  return NextResponse.json({ question: out });
}
