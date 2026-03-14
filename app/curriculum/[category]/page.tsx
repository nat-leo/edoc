"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DOMPurify from "dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Problem = {
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
};

type ApiPayload = {
  items?: unknown;
  problem?: unknown;
};

function normalizeProblem(value: unknown): Problem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title : "";
  const titleSlug = typeof obj.titleSlug === "string" ? obj.titleSlug : "";
  const difficulty = typeof obj.difficulty === "string" ? obj.difficulty : "Unknown";
  const content = typeof obj.content === "string" ? obj.content : "";

  if (!title || !titleSlug) {
    return null;
  }

  return { title, titleSlug, difficulty, content };
}

function difficultyVariant(difficulty: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = difficulty.toLowerCase();
  if (normalized.includes("easy")) {
    return "secondary";
  }
  if (normalized.includes("hard")) {
    return "destructive";
  }
  return "outline";
}

function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html);
}

export default function CurriculumCategoryPage() {
  const params = useParams<{ category: string }>();
  const category = useMemo(() => {
    const value = params?.category;
    return Array.isArray(value) ? value[0] : value;
  }, [params]);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) {
      setIsLoading(false);
      setError("Missing category");
      return;
    }

    async function loadProblems() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/curriculum/${encodeURIComponent(category)}`);
        const data = (await res.json()) as ApiPayload;

        if (!res.ok) {
          throw new Error("Failed to load problems");
        }

        const list: Problem[] = [];
        if (Array.isArray(data.items)) {
          data.items.forEach((item) => {
            const problem = normalizeProblem(item);
            if (problem) {
              list.push(problem);
            }
          });
        } else {
          const single = normalizeProblem(data.problem);
          if (single) {
            list.push(single);
          }
        }

        setProblems(list);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load problems");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadProblems();
  }, [category]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading problems...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (problems.length === 0) {
    return <p className="text-sm text-muted-foreground">No problems found for this category.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {problems.map((problem) => (
        <Card key={problem.titleSlug} className="h-full">
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="line-clamp-2 text-base">{problem.title}</CardTitle>
              <Badge variant={difficultyVariant(problem.difficulty)}>{problem.difficulty}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="relative h-28 overflow-hidden text-sm text-muted-foreground">
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(problem.content) }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button asChild className="w-full">
              <Link href={`/problems/${problem.titleSlug}`}>Solve</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
