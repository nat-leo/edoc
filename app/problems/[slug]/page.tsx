"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Editor from "@monaco-editor/react";
import { marked } from "marked";

import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { JUDGE0_LANGUAGE_ID, Language, ProblemSignature as StarterProblemSignature, renderStarterCode } from "@/lib/starter_code";

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

type Example = {
  id?: string;
  name: string;
  input: any;
  output: any;
  explanation?: string;
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
  examples?: Example[];
  [key: string]: unknown;
};

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
        const response = await fetch(`/api/problem/${slug}`, {
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

  const [customTests, setCustomTests] = React.useState<string>(
    "nums = [2,7,11,15]\ntarget = 9"
  );

  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [results, setResults] = React.useState<{ stdout?: string; stderr?: string }>({});

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
      });
      setStatus("success");
    } catch (e) {
      setResults({ stdout: "", stderr: e instanceof Error ? e.message : "Run failed" });
      setStatus("error");
    }
  }

  async function onSubmit() {
    console.log("TODO");
  }

  const statusPill = (() => {
    if (status === "running") return <Badge variant="secondary">Running…</Badge>;
    if (status === "success") return <Badge>OK</Badge>;
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

            <ResizableHandle />

            {/* BOTTOM: Testcases + Results */}
            <ResizablePanel defaultSize={32} minSize={18}>
              <div className="flex h-full flex-col">
                <Tabs defaultValue="testcases" className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <TabsList>
                      <TabsTrigger value="testcases">Testcases</TabsTrigger>
                      <TabsTrigger value="results">Results</TabsTrigger>
                    </TabsList>
                    <div className="text-xs text-muted-foreground">
                      Drag the handles to resize
                    </div>
                  </div>

                  <TabsContent value="testcases" className="min-h-0 flex-1 p-3">
                    <div className="flex h-full flex-col gap-2">
                      <div className="text-sm font-medium">Custom Input</div>
                      <Textarea
                        value={customTests}
                        onChange={(e) => setCustomTests(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        placeholder="Enter custom test input here..."
                      />
                      <div className="text-xs text-muted-foreground">
                        {/* UNSOLDERED WIRE: parse/validate per language + problem input schema */}
                        Input format is currently free-form.
                      </div>
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
