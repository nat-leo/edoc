"use client";

import * as React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";

import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { JUDGE0_LANGUAGE_ID, Language, ProblemSignature as StarterProblemSignature, renderStarterCode } from "@/lib/starter-code";
import { badgeFromCase, CaseBadge, JudgeCaseResult, RunResponse } from "@/lib/judge0";

type RunStatus = "idle" | "running" | "success" | "error";

type ProblemTag = {
  name: string;
  slug?: string;
};

type CanonType = "int" | "int[]" | "int[][]" | "string" | "string[]" | "boolean" | "void";

type Signature = {
  functionName: string;
  params: { name: string; type: CanonType }[];
  returnType: CanonType;
};

type SupportedLanguage = {
  slug: "typescript" | "python" | "java";
  judge0LanguageId: number;
};

type ProblemQuestion = {
  title?: string;
  titleSlug?: string;
  difficulty?: string;
  topicTags?: ProblemTag[];
  content?: string;
  constraints?: string[];
  signature?: Signature;
  runner?: { type: "function"; entrypoint: string };
  judge?: { inputFormat?: "json"; outputFormat?: "json"; comparator?: string };
  supportedLanguages?: SupportedLanguage[];
  starterCode?: Record<string, string>;
  exampleTestcases?: string;
  paramOrder?: string[];
  metaData?: string; // This is JSON, but it's in string format.
  tests?: any[];
  [key: string]: unknown;
};

type Testcase = Record<string, string> & { _expected?: string };

function parseExampleTestcasesToCases(
  exampleTestcases: string,
  paramNames: string[]
): Testcase[] {
  const arity = paramNames.length || 1;
  const lines = exampleTestcases
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Testcase[] = [];
  for (let i = 0; i < lines.length; i += arity) {
    const chunk = lines.slice(i, i + arity);
    if (chunk.length < arity) break;

    const obj: Testcase = {};
    for (let j = 0; j < arity; j++) obj[paramNames[j]] = chunk[j];
    out.push(obj);
  }
  return out;
}

function testsToCases(
  tests: any[] | undefined,
  paramNames: string[]
): Testcase[] {
  if (!Array.isArray(tests) || !tests.length) return [];
  const names = paramNames.length ? paramNames : ["input"];
  return tests.slice(0, 3).map((t) => {
    const args = t?.args ?? {};
    const obj: Testcase = {};
    for (const name of names) {
      const val = args[name];
      obj[name] =
        typeof val === "string"
          ? val
          : val === undefined
          ? ""
          : JSON.stringify(val);
    }
    if (typeof t?.solutionOutput !== "undefined") {
      obj._expected =
        typeof t.solutionOutput === "string"
          ? t.solutionOutput
          : JSON.stringify(t.solutionOutput);
    }
    return obj;
  });
}

function serializeCasesToExampleTestcases(
  cases: Testcase[],
  paramNames: string[]
): string {
  if (!cases.length || !paramNames.length) return "";

  return cases
    .map((testcase) =>
      paramNames
        .map((name) => (testcase[name] ?? "").trim())
        .join("\n")
    )
    .join("\n");
}

function parseJsonMaybe(v: string | undefined) {
  if (typeof v === "undefined") return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function extractCaseStdout(stdoutRaw: string | null | undefined): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  if (!stdoutRaw) return out;

  const lines = stdoutRaw.split(/\r?\n/).filter((line) => line.length > 0);
  let pending: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        (parsed as Record<string, unknown>).type === "CASE"
      ) {
        const caseIndex = (parsed as Record<string, unknown>).i;
        if (typeof caseIndex === "number" && Number.isFinite(caseIndex)) {
          if (!out[caseIndex]) out[caseIndex] = [];
          if (pending.length > 0) {
            out[caseIndex].push(...pending);
            pending = [];
          }
        }
        continue;
      }
      pending.push(line);
    } catch {
      pending.push(line);
    }
  }

  return out;
}

type AnyObj = Record<string, unknown>;

function extractQuestion(payload: any): any | null {
  return (
    payload?.question ??
    payload?.problem ??
    payload?.data?.question ??
    payload?.data?.problem ??
    payload?.data ??
    null
  );
}

function errorFrom(res: Response, payload: any) {
  const msg =
    typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as any).error)
      : `Failed to load problem (HTTP ${res.status})`;
  const err = new Error(msg);
  (err as any).status = res.status;
  return err;
}

async function readJson(res: Response): Promise<any> {
  return (await res.json().catch(() => ({} as AnyObj))) ?? {};
}

export async function fetchProblemWithFallback(
  slug: string,
  signal: AbortSignal
): Promise<{ resolved: ProblemQuestion; source: "db" | "leetcode" }> {
  // 1) DB first
  let res = await fetch(`/api/problems/${slug}`, { signal });
  let payload = await readJson(res);

  // if (res.status === 404) {
  //   // 2) fallback to LeetCode
  //   res = await fetch(`/api/leetcode/problems/${slug}`, { signal });
  //   payload = await readJson(res);

  //   if (!res.ok) throw errorFrom(res, payload);

  //   const q = extractQuestion(payload);
  //   if (!q) throw new Error("Problem data is missing");

  //   const resolved = q as ProblemQuestion;

  //   // ingest ONLY when we had to hit LeetCode (fire-and-forget)
  //   fetch("/api/ingest/problem", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       title: resolved.title,
  //       titleSlug: resolved.titleSlug,
  //       content: resolved.content,
  //       difficulty: resolved.difficulty,
  //       starterCode: resolved.starterCode,
  //       metaData: resolved.metaData, // standardized ✅
  //       exampleTestcases: resolved.exampleTestcases,
  //     }),
  //   }).catch((e) => console.error("ingest failed", e));

  //   return { resolved, source: "leetcode" };
  // }

  // DB returned something other than 404
  if (!res.ok) throw errorFrom(res, payload);

  const q = extractQuestion(payload);
  if (!q) throw new Error("Problem data is missing");

  return { resolved: q as ProblemQuestion, source: "db" };
}


export default function CodeEditorPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug =
    typeof slugParam === "string"
      ? slugParam
      : Array.isArray(slugParam)
      ? slugParam.join("/")
      : "";

  const [problemData, setProblemData] = React.useState<ProblemQuestion | null>(null);
  const [problemLoading, setProblemLoading] = React.useState(false);
  const [problemError, setProblemError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slug) {
      setProblemData(null);
      setProblemLoading(false);
      setProblemError(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchProblem = async () => {
      setProblemLoading(true);
      setProblemError(null);

      try {
        const { resolved, source } = await fetchProblemWithFallback(
          slug,
          controller.signal
        );

        if (!active) return;

        setProblemData(resolved);
        setCustomTests(resolved.exampleTestcases ?? "");

        const defaultLang = ((resolved.supportedLanguages?.[1]?.slug ??
          "python") as Language);
        setLanguage(defaultLang);

        console.log("Loaded problem from:", source, resolved);
      } catch (error) {
        if (!active) return;
        setProblemData(null);
        setProblemError(error instanceof Error ? error.message : "Unable to load problem");
      } finally {
        if (!active) return;
        setProblemLoading(false);
      }
    };


    fetchProblem();

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug]);

  const [language, setLanguage] = React.useState<Language>("python");
  const [code, setCode] = React.useState<string>("");

  const [customTests, setCustomTests] = React.useState<string>("");

  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [results, setResults] = React.useState<RunResponse | null>(null);
  const [caseResults, setCaseResults] = React.useState<Record<number, JudgeCaseResult>>({});
  const [caseBadges, setCaseBadges] = React.useState<Record<number, CaseBadge>>({});
  const [activeTab, setActiveTab] = React.useState<"testcases" | "results">("testcases");
  const [openResultCase, setOpenResultCase] = React.useState<number | null>(null);

  const problemTitle =
    problemData?.title ?? (problemLoading ? "Loading problem..." : "Problem");
  const problemDifficulty = problemData?.difficulty ?? "Unknown";
  const problemTags = problemData?.topicTags ?? [];
  const problemContent = problemData?.content ?? "";

  // Keep starter code in sync when language changes (simple UX default)
  React.useEffect(() => {
    if (!problemData) return;
    const starter = problemData.starterCode?.[language];
    if (starter) {
      setCode(starter);
      return;
    }

    if (problemData.signature) {
      setCode(
        renderStarterCode(
          problemData.signature as StarterProblemSignature,
          language
        )
      );
    }
  }, [language, problemData]);

  const signatureParamNames =
    problemData?.signature?.params?.map((p) => p.name) ?? [];
  const paramOrderNames = problemData?.paramOrder ?? [];
  const paramNames =
    signatureParamNames.length > 0
      ? signatureParamNames
      : paramOrderNames.length > 0
      ? paramOrderNames
      : ["input"];
  const [caseIndex, setCaseIndex] = React.useState(0);
  const [cases, setCases] = React.useState<Testcase[]>([]);
  const serializedCustomTests = React.useMemo(
    () => serializeCasesToExampleTestcases(cases, paramNames),
    [cases, paramNames]
  );
  const pathname = usePathname();
  const router = useRouter();
  const redirectingRef = React.useRef(false);

  const redirectToLogin = React.useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.push(`/login?redirectTo=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  React.useEffect(() => {
    if (!problemData) return;

    const names = paramNames.length ? paramNames : ["input"];

    const seededFromTests = testsToCases(problemData.tests as any[], names);

    const seeded =
      seededFromTests.length > 0
        ? seededFromTests
        : problemData.exampleTestcases && paramNames.length
        ? parseExampleTestcasesToCases(problemData.exampleTestcases, paramNames)
        : [Object.fromEntries(names.map((n) => [n, ""])) as Testcase];

    setCases(seeded.length ? seeded : [Object.fromEntries(names.map((n) => [n, ""])) as Testcase]);
    setCaseIndex(0);
    // only rerun when switching problems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemData?.titleSlug]);

  function updateCaseState(nextCases: JudgeCaseResult[]) {
    setCaseResults((prev) => {
      const merged = { ...prev };
      for (const c of nextCases) merged[c.i] = c;
      return merged;
    });

    setCaseBadges((prev) => {
      const merged = { ...prev };
      for (const c of nextCases) merged[c.i] = badgeFromCase(c);
      return merged;
    });
  }

  function buildRunnerCases() {
    return cases.map((c, i) => {
      const { _expected, ...args } = c;
      return {
        i,
        args,
        expected: typeof _expected !== "undefined" ? parseJsonMaybe(_expected) : undefined,
      };
    });
  }

  async function execute(mode: "run" | "submit") {
    setStatus("running");
    setResults(null);

    // optimistic badge: mark visible cases as running
    setCaseBadges((prev) => {
      const next: Record<number, CaseBadge> = { ...prev };
      cases.forEach((_, i) => {
        next[i] = "running";
      });
      return next;
    });

    const langId = JUDGE0_LANGUAGE_ID[language as Language];
    if (!langId) throw new Error(`Unsupported language: ${language}`);

    try {
      const isRun = mode === "run";
      const submitRes = await fetch(isRun ? "/api/run" : "/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRun
            ? {
                source_code: code,
                language_id: langId,
                metaData: problemData?.metaData ?? null,
                test_cases: serializedCustomTests || null,
                cases_struct: buildRunnerCases(),
              }
            : {
                slug,
                source_code: code,
                language_id: langId,
              }
        ),
      });

      const submit = await submitRes.json().catch(() => ({} as any));
      if (!submitRes.ok) {
        if (!isRun && submitRes.status === 401) {
          redirectToLogin();
          throw new Error("Please sign in to submit");
        }
        throw new Error(submit?.error ?? `${mode} submit failed`);
      }

      const token = submit?.token as string | undefined;
      if (!token) throw new Error("No token returned from API");
      const submissionId = !isRun ? (submit?.submissionId as string | undefined) : undefined;

      let poll: RunResponse | null = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const pollParams = new URLSearchParams({ token });
        if (!isRun && submissionId) pollParams.set("submissionId", submissionId);
        if (!isRun && slug) pollParams.set("slug", slug);
        const pollRes = await fetch(
          `/${mode === "run" ? "api/run" : "api/submit"}?${pollParams.toString()}`
        );
        poll = await pollRes.json().catch(() => null);
        if (!pollRes.ok) {
          if (!isRun && pollRes.status === 401) {
            redirectToLogin();
            throw new Error("Session expired. Please sign in again.");
          }
          throw new Error((poll as any)?.error ?? `${mode} poll failed`);
        }

        const statusId = poll?.status?.id;
        if (statusId && statusId !== 1 && statusId !== 2) break;
      }

      if (poll) {
        updateCaseState(poll.cases ?? []);
        setResults(poll);
      }
      setStatus("success");
    } catch (e) {
      setResults({
        token: undefined,
        status: undefined,
        stdout_raw: "",
        stderr_raw: e instanceof Error ? e.message : "Run failed",
        cases: [],
      });
      setStatus("error");
    } finally {
      if (mode === "submit") {
        setActiveTab("results");
      }
    }
  }

  const onRun = () => execute("run");
  const onSubmit = () => execute("submit");

  const statusPill = (() => {
    if (status === "running") return <Badge variant="secondary">Running…</Badge>;
    if (status === "success") return <Badge>Success!</Badge>;
    if (status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="outline">Idle</Badge>;
  })();
  const caseStdout = React.useMemo(
    () => extractCaseStdout(results?.stdout_raw),
    [results?.stdout_raw]
  );

  function formatMetric(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return "n/a";
  }

  function badgeClass(b: CaseBadge | undefined) {
    if (b === "pass") return "border border-emerald-500 text-emerald-600";
    if (b === "fail" || b === "error") return "border border-destructive text-destructive";
    else return "rounded-full text-black";
  }

  const isHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s)

  return (
    <div className="h-[calc(100vh-2rem)] w-full p-4">
      <ResizablePanelGroup orientation="horizontal" className="h-full rounded-lg border">
        {/* LEFT: Problem */}
        <ResizablePanel defaultSize={38} minSize={20} className="bg-background">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-lg font-semibold">{problemTitle}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{problemDifficulty}</Badge>
                  {problemTags.map((tag) => (
                    <Badge key={`${tag.slug ?? tag.name}`} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0">{statusPill}</div>
            </div>

            <Separator />

            <ScrollArea className="flex-1 h-full w-full overflow-hidden p-4">
              <div className="space-y-6">
                <section className="space-y-2">
                  <div className="text-sm font-semibold">Description</div>

                  {problemError ? (
                    <p className="text-sm text-destructive">{problemError}</p>
                  ) : problemContent ? (
                    isHtml(problemContent) ? (
                      <div
                        className="prose prose-neutral dark:prose-invert max-w-none break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(problemContent) }}
                      />
                    ) : (
                      <article className="prose prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown>{problemContent}</ReactMarkdown>
                      </article>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {problemLoading ? "Loading problem description..." : "No description is available."}
                    </p>
                  )}
                </section>
              </div>
            </ScrollArea>

          </div>
        </ResizablePanel>

        <ResizableHandle />
                    
        {/* RIGHT: Editor + Bottom (tests/results) */}
        <ResizablePanel defaultSize={62} minSize={35} className="bg-background">
          <ResizablePanelGroup orientation="vertical" className="h-full">
            {/* TOP: Monaco */}
            <ResizablePanel defaultSize={68} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-2 border-b p-3">
                  <div className="flex items-center gap-2">
                    <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                      <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(problemData?.starterCode ?? {}).map((slug) => (
                          <SelectItem key={slug} value={slug}>
                            {slug? slug: "No Language Available"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="text-xs text-muted-foreground">
                      {/* UNSOLDERED WIRE: hook up autosave, dirty state, etc. */}
                      Autosave: off
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={onRun} disabled={status === "running"}>
                      Run
                    </Button>
                    <Button onClick={onSubmit} disabled={status === "running"}>
                      Submit
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <Editor
                    height="100%"
                    language={language === "python" ? "python" : language}
                    value={code}
                    onChange={(v) => setCode(v ?? "")}
                    theme="vs-light"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>

            {/* BOTTOM: Testcases + Results */}
            <ResizablePanel defaultSize={32} minSize={18}>
                <div className="flex h-full flex-col">
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "testcases" | "results")}
                    className="flex h-full flex-col"
                  >
                    <div className="flex items-center justify-between border-t px-3 py-2">
                      <TabsList>
                        <TabsTrigger value="testcases">Testcases</TabsTrigger>
                        <TabsTrigger value="results">Results</TabsTrigger>
                      </TabsList>
                      <div className="text-xs text-muted-foreground">
                        Drag the handles to resize
                      </div>
                    </div>
                  
                    {/* That Leetcode-style testcases bottom spot that lets you add test cases. */}
                    <TabsContent value="testcases" className="min-h-0 flex-1 p-3">
                        <div className="flex h-full flex-col gap-3">
                          {/* Case tabs */}
                          <ScrollArea className="w-full h-10">
                            <div className="flex w-max items-center gap-2 pr-2">
                              {cases.map((_, i) => (
                                <Button
                                  key={i}
                                  type="button"
                                  variant={i === caseIndex ? "secondary" : "ghost"}
                                  size="sm"
                                  onClick={() => setCaseIndex(i)}
                                  className={`rounded-full ${badgeClass(caseBadges[i])}`}
                                >
                                  Case {i + 1}
                                </Button>
                              ))}

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCases((prev) => [
                                    ...prev,
                                    Object.fromEntries(paramNames.map((n: string) => [n, ""])),
                                  ]);
                                  setCaseIndex(cases.length);
                                }}
                                className="rounded-full"
                              >
                                +
                              </Button>
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>

                          {/* Scrollable parameter inputs */}
                          <ScrollArea className="min-h-0 flex-1">
                            <div className="space-y-4 pr-2">
                              {paramNames.map((name: string) => {
                                const value = cases[caseIndex]?.[name] ?? "";
                                const isMultiLine =
                                  value.includes("\n") ||
                                  value.trim().startsWith("[") ||
                                  value.trim().startsWith("{");

                                return (
                                  <div key={name} className="space-y-2">
                                    <div className="text-sm text-muted-foreground font-semibold">
                                      {name} =
                                    </div>

                                    <div className="rounded-xl bg-muted/50 p-3">
                                      <Input
                                        value={value}
                                        onChange={(e) => {
                                          const next = e.target.value;
                                          setCases((prev) => {
                                            const copy = [...prev];
                                            copy[caseIndex] = { ...copy[caseIndex], [name]: next };
                                            return copy;
                                          });
                                        }}
                                        className="border-0 bg-transparent p-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
                                        placeholder={name === "nums" ? "[2,7,11,15]" : "9"}
                                      />
                                    </div>
                                  </div>
                                );
                              })}

                              <div className="space-y-2">
                                <div className="text-sm text-muted-foreground font-semibold">
                                  stdout =
                                </div>
                                <div className="rounded-xl bg-muted/50 p-3">
                                  <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-foreground">
                                    {(caseStdout[caseIndex] ?? []).join("\n") ||
                                      "Run or Submit to see stdout for this case."}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </ScrollArea>
                        </div>
                    </TabsContent>


                  <TabsContent value="results" className="min-h-0 flex-1 p-3">
                    <div className="flex h-full flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Run Output</div>
                        {statusPill}
                      </div>
                      <Card className="min-h-0 flex-1 p-3">
                        <ScrollArea className="h-full">
                          <div className="space-y-3">
                            {results?.cases?.length ? (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  {status === "success" || status === "error" ? "Pass/Fail" : "Cases"}
                                </div>
                                <div className="flex flex-col gap-2">
                                  {results.cases.map((c) => {
                                    const open = openResultCase === c.i;
                                    const badge = caseBadges[c.i];
                                    return (
                                      <Card key={c.i} className="p-2 border">
                                        <button
                                          type="button"
                                          onClick={() => setOpenResultCase(open ? null : c.i)}
                                          className="flex w-full items-center justify-between text-xs font-semibold"
                                        >
                                          <span>Case {c.i + 1}</span>
                                          <span className={`px-2 py-1 text-[10px] ${badgeClass(badge)}`}>
                                            {badge ?? "ran"}
                                          </span>
                                        </button>
                                        {open ? (
                                          <div className="mt-2 space-y-2">
                                            <div className="rounded-md border p-2 text-[11px] font-mono text-foreground">
                                              <div>MS: {formatMetric(c.runtime_ms)}</div>
                                              <div>MB: {formatMetric(c.mb)}</div>
                                              <div>Load: {formatMetric(c.n)}</div>
                                            </div>
                                            <div className="rounded-md border p-2">
                                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Stdout
                                              </div>
                                              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all text-[11px] font-mono text-foreground">
                                                {(caseStdout[c.i] ?? []).join("\n") || "(no stdout for this case)"}
                                              </pre>
                                            </div>
                                          </div>
                                        ) : null}
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {results?.stdout_raw && !results?.cases?.length ? (
                              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-foreground">
                                {results.stdout_raw}
                              </pre>
                            ) : null}

                            {results?.stderr_raw ? (
                              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-destructive">
                                {results.stderr_raw}
                              </pre>
                            ) : null}

                            {!results?.stdout_raw && !results?.stderr_raw && !results?.cases?.length ? (
                              <p className="text-sm text-muted-foreground">
                                No results yet. Click Run or Submit.
                              </p>
                            ) : null}
                          </div>
                        </ScrollArea>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel> {/* BOTTOM and Roght Live in the below panel group */}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
