// lib/starter-code.ts

export const JUDGE0_LANGUAGE_ID: Record<Language, number> = {
  typescript: 45, // TypeScript (Node.js) on many Judge0 instances
  python: 32,     // Python (3.13)
  java: 4,       // Java
};

export type CanonType =
  | "int"
  | "int[]"
  | "int[][]"
  | "string"
  | "string[]"
  | "boolean"
  | "void";

export type Language = "typescript" | "python" | "java";

export type Param = { name: string; type: CanonType };

export type ProblemSignature = {
  titleSlug: string;
  functionName: string;
  params: Param[];
  returnType: CanonType;
};

const TYPE_MAP: Record<Language, Record<CanonType, string>> = {
  typescript: {
    int: "number",
    "int[]": "number[]",
    "int[][]": "number[][]",
    string: "string",
    "string[]": "string[]",
    boolean: "boolean",
    void: "void",
  },
  python: {
    int: "int",
    "int[]": "List[int]",
    "int[][]": "List[List[int]]",
    string: "str",
    "string[]": "List[str]",
    boolean: "bool",
    void: "None",
  },
  java: {
    int: "int",
    "int[]": "int[]",
    "int[][]": "int[][]",
    string: "String",
    "string[]": "String[]",
    boolean: "boolean",
    void: "void",
  },
};

function paramsFor(language: Language, params: Param[]): string {
  const map = TYPE_MAP[language];

  if (language === "python") {
    return params.map((p) => `${p.name}: ${map[p.type]}`).join(", ");
  }

  if (language === "typescript") {
    return params.map((p) => `${p.name}: ${map[p.type]}`).join(", ");
  }

  // java: "Type name"
  return params.map((p) => `${map[p.type]} ${p.name}`).join(", ");
}

function returnTypeFor(language: Language, t: CanonType): string {
  return TYPE_MAP[language][t];
}

const TEMPLATES: Record<Language, string> = {
  typescript: `export function {{FN}}({{PARAMS}}): {{RET}} {
  // TODO: implement
  return -1 as any;
}
`,
  python: `from typing import List
from collections import deque

class Solution:
    def {{FN}}(self, {{PARAMS}}) -> {{RET}}:
        # TODO: implement
        return -1
`,
  java: `import java.util.*;

class Solution {
    public {{RET}} {{FN}}({{PARAMS}}) {
        // TODO: implement
        return -1;
    }
}
`,
};

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export function renderStarterCode(sig: ProblemSignature, language: Language): string {
  const tpl = TEMPLATES[language];

  // For void-return problems, you probably don't want "return -1".
  // Keep it simple here; you can refine later.
  const PARAMS = paramsFor(language, sig.params);
  const RET = returnTypeFor(language, sig.returnType);

  // If Python has no params, avoid trailing comma after "self,"
  const pythonParams = language === "python"
    ? (PARAMS.length ? `self, ${PARAMS}` : "self")
    : PARAMS;

  const code = fillTemplate(tpl, {
    FN: sig.functionName,
    PARAMS: language === "python" ? pythonParams : PARAMS,
    RET,
  });

  return code;
}

// Example signature for your BFS shortest-path problem:
export const BFS_SHORTEST_PATH: ProblemSignature = {
  titleSlug: "breadth-first-search-find-the-shortest-path-in-an-unweighted-graph",
  functionName: "shortestPath",
  params: [
    { name: "n", type: "int" },
    { name: "graph", type: "int[][]" },
    { name: "start", type: "int" },
    { name: "target", type: "int" },
  ],
  returnType: "int",
};

// Quick usage example:
// console.log(renderStarterCode(BFS_SHORTEST_PATH, "typescript"));
// console.log(renderStarterCode(BFS_SHORTEST_PATH, "python"));
// console.log(renderStarterCode(BFS_SHORTEST_PATH, "java"));
