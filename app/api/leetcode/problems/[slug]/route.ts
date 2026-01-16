import { NextResponse } from "next/server";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }>} ) {

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
            codeSnippets { lang langSlug code }
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
  return NextResponse.json(json, { status: res.status });
}
