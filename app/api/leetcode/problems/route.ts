/* Here's what a response might look like for problem descriptions:
{
  "data": {
    "question": {
      "questionId": "1",
      "questionFrontendId": "1",
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "content": "<p>Given an array of integers <code>nums</code>&nbsp;and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>\n\n<p>You may assume that each input would have <strong><em>exactly</em> one solution</strong>, and you may not use the <em>same</em> element twice.</p>\n\n<p>You can return the answer in any order.</p>\n\n<p>&nbsp;</p>\n<p><strong class=\"example\">Example 1:</strong></p>\n\n<pre>\n<strong>Input:</strong> nums = [2,7,11,15], target = 9\n<strong>Output:</strong> [0,1]\n<strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].\n</pre>\n\n<p><strong class=\"example\">Example 2:</strong></p>\n\n<pre>\n<strong>Input:</strong> nums = [3,2,4], target = 6\n<strong>Output:</strong> [1,2]\n</pre>\n\n<p><strong class=\"example\">Example 3:</strong></p>\n\n<pre>\n<strong>Input:</strong> nums = [3,3], target = 6\n<strong>Output:</strong> [0,1]\n</pre>\n\n<p>&nbsp;</p>\n<p><strong>Constraints:</strong></p>\n\n<ul>\n\t<li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>\n\t<li><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li>\n\t<li><code>-10<sup>9</sup> &lt;= target &lt;= 10<sup>9</sup></code></li>\n\t<li><strong>Only one valid answer exists.</strong></li>\n</ul>\n\n<p>&nbsp;</p>\n<strong>Follow-up:&nbsp;</strong>Can you come up with an algorithm that is less than <code>O(n<sup>2</sup>)</code><font face=\"monospace\">&nbsp;</font>time complexity?",
      "difficulty": "Easy",
      "likes": 66522,
      "dislikes": 2475,
      "isPaidOnly": false,
      "topicTags": [
        { "name": "Array", "slug": "array" },
        { "name": "Hash Table", "slug": "hash-table" }
      ],
      "stats": "{\"totalAccepted\": \"20.1M\", \"totalSubmission\": \"35.4M\", \"totalAcceptedRaw\": 20114580, \"totalSubmissionRaw\": 35418153, \"acRate\": \"56.8%\"}",
      "hints": [
        "A really brute force way would be to search for all possible pairs of numbers but that would be too slow. Again, it's best to try out brute force solutions just for completeness. It is from these brute force solutions that you can come up with optimizations.",
        "So, if we fix one of the numbers, say <code>x</code>, we have to scan the entire array to find the next number <code>y</code> which is <code>value - x</code> where value is the input parameter. Can we change our array somehow so that this search becomes faster?",
        "The second train of thought is, without changing the array, can we use additional space somehow? Like maybe a hash map to speed up the search?"
      ],
      "exampleTestcases": "[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6"
    }
  }
}
*/


/* Here's a smaple API response for problems.
{
  "data": {
    "problemsetQuestionListV2": {
      "questions": [
        {
          "difficulty": "EASY",
          "id": 1,
          "paidOnly": false,
          "questionFrontendId": "1",
          "status": "TO_DO",
          "title": "Two Sum",
          "titleSlug": "two-sum",
          "topicTags": [
            { "name": "Array", "slug": "array", "__typename": "CommonTagNode" },
            { "name": "Hash Table", "slug": "hash-table", "__typename": "CommonTagNode" }
          ],
          "frequency": null,
          "isInMyFavorites": false,
          "acRate": 0.5679170031587505,
          "contestPoint": null,
          "__typename": "ProblemSetQuestionNode"
        },
        {
          "difficulty": "MEDIUM",
          "id": 2,
          "paidOnly": false,
          "questionFrontendId": "2",
          "status": "TO_DO",
          "title": "Add Two Numbers",
          "titleSlug": "add-two-numbers",
          "topicTags": [
            { "name": "Linked List", "slug": "linked-list", "__typename": "CommonTagNode" },
            { "name": "Math", "slug": "math", "__typename": "CommonTagNode" },
            { "name": "Recursion", "slug": "recursion", "__typename": "CommonTagNode" }
          ],
          "frequency": null,
          "isInMyFavorites": false,
          "acRate": 0.47599925781113295,
          "contestPoint": null,
          "__typename": "ProblemSetQuestionNode"
        },
        {
          "difficulty": "MEDIUM",
          "id": 3,
          "paidOnly": false,
          "questionFrontendId": "3",
          "status": "TO_DO",
          "title": "Longest Substring Without Repeating Characters",
          "titleSlug": "longest-substring-without-repeating-characters",
          "topicTags": [
            { "name": "Hash Table", "slug": "hash-table", "__typename": "CommonTagNode" },
            { "name": "String", "slug": "string", "__typename": "CommonTagNode" },
            { "name": "Sliding Window", "slug": "sliding-window", "__typename": "CommonTagNode" }
          ],
          "frequency": null,
          "isInMyFavorites": false,
          "acRate": 0.3816456655710423,
          "contestPoint": null,
          "__typename": "ProblemSetQuestionNode"
        }
      ]
    }
  }
}

And Here's an example request from the endpoint below:
http://localhost:3000/api/problem?limit=3&skip=0
http://localhost:3000/api/problem?limit=3&skip=0&topic=breadth-first-search&topic=graph&combine=ALL
*/

// app/api/leetcode/problemset/route.ts
import { NextResponse } from "next/server";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

type Combine = "ALL" | "ANY";
type Operator = "IS" | "NOT" | "IN";

type QuestionFilterInput = {
  filterCombineType?: Combine;
  statusFilter?: { questionStatuses: string[]; operator: Operator };
  difficultyFilter?: { difficulties: string[]; operator: Operator };
  topicFilter?: { topicSlugs: string[]; operator: Operator };
  companyFilter?: { companySlugs: string[]; operator: Operator };
  languageFilter?: { languageSlugs: string[]; operator: Operator };
  // allow extra fields without TS fighting you
  [k: string]: any;
};

function defaultFilters(): QuestionFilterInput {
  // This mirrors the *shape* LeetCode’s own UI sends (empty lists + operator). :contentReference[oaicite:2]{index=2}
  return {
    filterCombineType: "ALL",
    statusFilter: { questionStatuses: [], operator: "IS" },
    difficultyFilter: { difficulties: [], operator: "IS" },
    topicFilter: { topicSlugs: [], operator: "IS" },
    companyFilter: { companySlugs: [], operator: "IS" },
    languageFilter: { languageSlugs: [], operator: "IS" },
  };
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);

  const categorySlug = u.searchParams.get("categorySlug") ?? "";
  const searchKeyword = u.searchParams.get("searchKeyword") ?? "";
  const skip = Number(u.searchParams.get("skip") ?? "0");
  const limit = Number(u.searchParams.get("limit") ?? "100");
  const sortBy = null;

  // Prefer friendly query params if provided:
  //   ?topic=graph&topic=breadth-first-search&combine=ALL
  const topics = u.searchParams.getAll("topic");
  const combine = (u.searchParams.get("combine") ?? "").toUpperCase() as Combine;

  // Back-compat: filters as JSON in query param: ?filters={...}
  const filtersParam = u.searchParams.get("filters");
  const parsed = safeJsonParse<QuestionFilterInput>(filtersParam);

  // Build filters
  const filters: QuestionFilterInput = {
    ...defaultFilters(),
    ...(parsed ?? {}),
  };

  // Normalize filterCombineType (LeetCode uses ALL/ANY, not AND) :contentReference[oaicite:3]{index=3}
  if (combine === "ALL" || combine === "ANY") {
    filters.filterCombineType = combine;
  } else if (filters.filterCombineType !== "ALL" && filters.filterCombineType !== "ANY") {
    filters.filterCombineType = "ALL";
  }

  // If topics specified via query params, override topicFilter safely
  if (topics.length) {
    filters.topicFilter = { topicSlugs: topics, operator: "IS" };
  } else if (!filters.topicFilter) {
    filters.topicFilter = { topicSlugs: [], operator: "IS" };
  }

  const r = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({
      query:
        "query problemsetQuestionListV2($filters: QuestionFilterInput, $limit: Int, $searchKeyword: String, $skip: Int, $sortBy: QuestionSortByInput, $categorySlug: String) { problemsetQuestionListV2(filters: $filters, limit: $limit, searchKeyword: $searchKeyword, skip: $skip, sortBy: $sortBy, categorySlug: $categorySlug) { questions { id questionFrontendId title titleSlug paidOnly difficulty acRate topicTags { name slug } } totalLength hasMore } }",
      variables: { categorySlug, searchKeyword, skip, limit, filters, sortBy },
    }),
  });

  const text = await r.text(); // preserve upstream error messages
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
