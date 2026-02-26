"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Problem = {
  title: string;
  titleSlug: string;
  difficulty: string;
};

export default function Home() {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = "/login?redirectTo=/";

  useEffect(() => {
    const fetchProblems = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/problems", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { problems?: Problem[] };
        setProblems(json.problems ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load problems");
      } finally {
        setLoading(false);
      }
    };
    fetchProblems();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/70 backdrop-blur dark:border-zinc-900 dark:bg-black/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold">edocteel</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href={loginHref}>Sign in</Link>
            </Button>

            <Button asChild>
              <Link href={loginHref}>Let&apos;s Practice</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <section className="flex flex-col justify-start">
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            Less grind.
            <br />
            Get cracked.
            
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            Edocteel is a test-like practice environment for entry-level
            engineers. Coding patterns are hidden within questions just like the Online Assessments.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => router.push(loginHref)}>
              Let&apos;s Practice
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-200 bg-transparent dark:border-zinc-900"
              asChild
            >
              <Link href="/login?redirectTo=/">Sign in</Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            It's ok to fail. Being bad is the first step to being sorta good at something.
          </p>

          <Separator className="my-8 bg-zinc-200 dark:bg-zinc-900" />

          <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm font-medium">Hidden patterns</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Train like the real OA.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Structured paths</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Core question types only.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Smart repeats</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                See the right reps again.
              </div>
            </div>
          </div>
        </section>

        {/* Right column: live problem list */}
        <section className="flex justify-center md:justify-end">
          <Card className="w-full max-w-lg border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950 md:max-h-[calc(100vh-8rem)] md:overflow-hidden">
            <div className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Fresh practice</div>
                <Badge variant="outline" className="border-zinc-200 text-zinc-700 dark:border-zinc-900 dark:text-zinc-300">
                  From our set
                </Badge>
              </div>

              <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                {loading ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading problems…</p>
                ) : error ? (
                  <p className="text-sm text-destructive">Failed to load: {error}</p>
                ) : problems.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">No problems available yet.</p>
                ) : (
                  problems.map((p) => (
                    <div
                      key={p.titleSlug}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <Badge variant="secondary" className="mt-1">{p.difficulty}</Badge>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={`/problems/${p.titleSlug}`}>Open</Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Sign in to start solving.
                </div>
                <Button asChild>
                  <Link href={loginHref}>Let&apos;s Practice</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="flex flex-col justify-between gap-3 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400 sm:flex-row">
          <span>© {new Date().getFullYear()} edocteel</span>
          <span> Let's Get It!</span>
        </div>
      </footer>
    </div>
  );
}
