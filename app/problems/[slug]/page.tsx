"use client";

import * as React from "react";
import { useParams } from "next/navigation";
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
  metaData?: string; // This is JSON, but it's in string format.
  [key: string]: unknown;
};

type Testcase = Record<string, string>;

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
        const response = await fetch(`/api/problems/${slug}`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({} as Record<string, unknown>))) ?? {};

        if (!response.ok) {
          throw new Error(
            typeof payload === "object" && payload !== null && "error" in payload
              ? String((payload as any).error)
              : "Failed to load problem"
          );
        }

        const question =
          (payload as any).question ??
          (payload as any).data?.question ??
          (payload as any).data ??
          null;

        if (!question) {
          throw new Error("Problem data is missing");
        }

        if (!active) return;
        const resolved = question as ProblemQuestion;
        setProblemData(resolved);
        setCustomTests(resolved.exampleTestcases ?? "");

        console.log("THINGS___________-------", resolved);
        // fire-and-forget upsert (do NOT block UI)
        fetch("/api/ingest/problem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: resolved.title,
            titleSlug: resolved.titleSlug,
            content: resolved.content,
            difficulty: resolved.difficulty,
            starterCode: resolved.starterCode,
            metaData: resolved.metadata,
            exampleTestcases: resolved.exampleTestcases,
        })
        }).catch((e) => console.error("ingest failed", e));

        const defaultLang = (
          (resolved.supportedLanguages?.[0]?.slug ?? "typescript") as Language
        );
        setLanguage(defaultLang);
      } catch (error) {
        if (!active) return;
        setProblemData(null);
        setProblemError(
          error instanceof Error ? error.message : "Unable to load problem"
        );
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

  const [language, setLanguage] = React.useState<Language>("typescript");
  const [code, setCode] = React.useState<string>("");

  const [customTests, setCustomTests] = React.useState<string>("");

  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [results, setResults] = React.useState<{ stdout?: string; stderr?: string, time?: string, memory?: string }>({});
  const [activeTab, setActiveTab] = React.useState<"testcases" | "results">("testcases");

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

  const paramNames = (problemData as any)?.signature?.params?.map((p: any) => p.name) ?? ["input"];
  const [caseIndex, setCaseIndex] = React.useState(0);
  const [cases, setCases] = React.useState<Testcase[]>([]);
  const serializedCustomTests = React.useMemo(
    () => serializeCasesToExampleTestcases(cases, paramNames),
    [cases, paramNames]
  );

  React.useEffect(() => {
    if (!problemData) return;

    const names = paramNames.length ? paramNames : ["input"];

    const seeded =
      problemData.exampleTestcases && paramNames.length
        ? parseExampleTestcasesToCases(problemData.exampleTestcases, paramNames)
        : [Object.fromEntries(names.map((n) => [n, ""])) as Testcase];

    setCases(seeded.length ? seeded : [Object.fromEntries(names.map((n) => [n, ""])) as Testcase]);
    setCaseIndex(0);
    // only rerun when switching problems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemData?.titleSlug]);

  async function onRun() {
    setStatus("running");
    setResults({ stdout: "Running...", stderr: "" });

    const langId = JUDGE0_LANGUAGE_ID[language as Language];
    if (!langId) throw new Error(`Unsupported language: ${language}`);

    try {
      // 1) submit -> token
      const submitRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: code,
          language_id: langId, // <-- make sure this is a Judge0 language_id number
          stdin: customTests ?? "",
          metadata: problemData?.metadata ?? null,
          test_cases: serializedCustomTests || null,
        }),
      });

      const submit = await submitRes.json().catch(() => ({} as any));
      if (!submitRes.ok) throw new Error(submit?.error ?? "Run submit failed");

      const token = submit?.token as string | undefined;
      if (!token) throw new Error("No token returned from /api/run");

      // 2) poll until finished
      let poll: any = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));

        const pollRes = await fetch(`/api/run?token=${encodeURIComponent(token)}`);
        poll = await pollRes.json().catch(() => ({} as any));
        if (!pollRes.ok) throw new Error(poll?.error ?? "Run poll failed");

        const statusId = poll?.status?.id;
        if (statusId && statusId !== 1 && statusId !== 2) break; // 1=In Queue, 2=Processing
      }

      setResults({
        stdout: String(poll?.stdout ?? ""),
        stderr: String(poll?.stderr ?? poll?.compile_output ?? poll?.message ?? ""),
        time: String(poll?.time ?? poll?.compile_output ?? poll?.message ?? ""),
        memory: String(poll?.memory ?? poll?.compile_output ?? poll?.message ?? ""),
      });
      setStatus("success");
    } catch (e) {
      setResults({ stdout: "", stderr: e instanceof Error ? e.message : "Run failed", time: "", memory: "" });
      setStatus("error");
    } finally {
      setActiveTab("results");
    }
  }

  async function onSubmit() {
    console.log("TODO");
  }

  const statusPill = (() => {
    if (status === "running") return <Badge variant="secondary">Running…</Badge>;
    if (status === "success") return <Badge>Success!</Badge>;
    if (status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="outline">Idle</Badge>;
  })();

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
                        {(problemData?.supportedLanguages ?? []).map((l) => (
                          <SelectItem key={l.slug} value={l.slug}>
                            {l.slug === "typescript"
                              ? "TypeScript"
                              : l.slug === "python"
                                ? "Python"
                                : "Java"}
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
                    language={language === "typescript" ? "typescript" : language}
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
                                  className="rounded-full"
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
                            {results.stdout ? (
                              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                                {results.stdout}
                              </pre>
                            ) : null}

                            {results.stderr ? (
                              <pre className="whitespace-pre-wrap font-mono text-sm text-destructive">
                                {results.stderr}
                              </pre>
                            ) : null}

                            {results.time ? (
                              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                                {results.time}
                              </pre>
                            ) : null}

                            {results.memory ? (
                              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                                {results.memory}
                              </pre>
                            ) : null}

                            {!results.stdout && !results.stderr ? (
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
