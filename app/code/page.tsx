"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";

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
import { METHODS } from "http";

type RunStatus = "idle" | "running" | "success" | "error";

const DEMO_PROBLEM = {
  title: "Two Sum",
  difficulty: "Easy",
  tags: ["Array", "Hash Table"],
  description: `
Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Return the answer in any order.
  `.trim(),
  examples: [
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
    },
  ],
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Exactly one valid answer exists.",
  ],
};

const STARTER_CODE: Record<string, string> = {
  typescript: `function twoSum(nums: number[], target: number): number[] {
  // TODO: implement
  return [];
}
`,
  python: `def two_sum(nums, target):
    # TODO: implement
    return []
`,
  java: `import java.util.*;

class Solution {
  public int[] twoSum(int[] nums, int target) {
    // TODO: implement
    return new int[] {};
  }
}
`,
};

export default function CodeEditorPage() {
  const [language, setLanguage] = React.useState<keyof typeof STARTER_CODE>("typescript");
  const [code, setCode] = React.useState<string>(STARTER_CODE.typescript);

  const [customTests, setCustomTests] = React.useState<string>(
    "nums = [2,7,11,15]\ntarget = 9"
  );

  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [results, setResults] = React.useState<{ stdout?: string; stderr?: string }>({});

  // Keep starter code in sync when language changes (simple UX default)
  React.useEffect(() => {
    setCode(STARTER_CODE[language] ?? "");
  }, [language]);

  async function onRun() {
    setStatus("running");
    setResults({stdout: "Running...", stderr: ""});

    try {
      // submit - If this app gains traction, we need to shift over to polling. We're going to be blocking for now
      //with wait=ture option available in judge
      
      const submit = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_code: code, language_id: 28, stdin: ""}),
      });

      const result = await submit.json()
      const token = result.token;

      // poll result
      const poll = await fetch(`/api/run?token=${token}`, { method: "GET" });
      const pollResult = await poll.json();

      setResults({
        stdout: pollResult?.stdout ?? undefined,
        stderr: pollResult?.stderr ?? undefined,
      });
      setStatus("success");

      console.log(result);

    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  async function onSubmit() {
    setStatus("running");
    setResults("");

    try {
      // UNSOLDERED WIRE: Replace with /api/submit call (hidden tests + persistence)
      await new Promise((r) => setTimeout(r, 900));
      setResults("Accepted\n\nAll hidden tests passed.\nRuntime: 48 ms\nMemory: 40.8 MB");
      setStatus("success");
    } catch (e: any) {
      setResults(e?.message ?? "Submit failed");
      setStatus("error");
    }
  }

  const statusPill = (() => {
    if (status === "running") return <Badge variant="secondary">Running…</Badge>;
    if (status === "success") return <Badge>OK</Badge>;
    if (status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="outline">Idle</Badge>;
  })();

  return (
    <div className="h-[calc(100vh-2rem)] w-full p-4">
      <ResizablePanelGroup orientation="horizontal" className="h-full rounded-lg border">
        {/* LEFT: Problem */}
        <ResizablePanel defaultSize={38} minSize={20} className="bg-background">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-lg font-semibold">{DEMO_PROBLEM.title}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{DEMO_PROBLEM.difficulty}</Badge>
                  {DEMO_PROBLEM.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0">{statusPill}</div>
            </div>

            <Separator />

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                <section className="space-y-2">
                  <div className="text-sm font-semibold">Description</div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {DEMO_PROBLEM.description}
                  </p>
                </section>

                <section className="space-y-2">
                  <div className="text-sm font-semibold">Examples</div>
                  <div className="space-y-3">
                    {DEMO_PROBLEM.examples.map((ex, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="text-xs text-muted-foreground">Input</div>
                        <pre className="mt-1 whitespace-pre-wrap text-sm">{ex.input}</pre>
                        <div className="mt-3 text-xs text-muted-foreground">Output</div>
                        <pre className="mt-1 whitespace-pre-wrap text-sm">{ex.output}</pre>
                        {ex.explanation ? (
                          <>
                            <div className="mt-3 text-xs text-muted-foreground">
                              Explanation
                            </div>
                            <p className="mt-1 text-sm">{ex.explanation}</p>
                          </>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="text-sm font-semibold">Constraints</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {DEMO_PROBLEM.constraints.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
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
                    <Select
                      value={language}
                      onValueChange={(v) => setLanguage(v as keyof typeof STARTER_CODE)}
                    >
                      <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
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
