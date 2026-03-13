"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Curriculum = {
    name: string;
    totalProblems: number;
    progress: number;
    content: string;
}

type ApiCurriculumItem = Partial<Curriculum> & Record<string, unknown>;

export function CurriculumCard({name, totalProblems, progress, content} : Curriculum) {
  return (
    <Card>
        <CardHeader>
            <CardTitle>{name}</CardTitle>
            <CardDescription>{progress} / {totalProblems} Problems</CardDescription>
        </CardHeader>
        <CardContent>
            <p>{content}</p>
        </CardContent>
        <div className="grid grid-cols-2 gap-2">
            <Button>Learn</Button>
            <Button>Test</Button>
        </div>
    </Card>
  );
}

export default function CurriculumPage() {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCurriculums() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/curriculum", { method: "GET" });
        if (!res.ok) {
          throw new Error(`Failed to fetch curriculum (${res.status})`);
        }

        const data = await res.json();
        const items: ApiCurriculumItem[] = Array.isArray(data?.items) ? data.items : [];
        const mapped: Curriculum[] = items.map((item) => ({
          name: item?.name ?? "Untitled",
          totalProblems: Number(item?.totalProblems ?? 0),
          progress: Number(item?.progress ?? 0),
          content: item?.content ?? "",
        }));
        setCurriculums(mapped);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load curriculum");
        }
        setCurriculums([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadCurriculums();
  }, []);

  if (isLoading) {
    return <p>Loading curriculum...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {curriculums.map((curr) => (
          <CurriculumCard key={curr.name} name={curr.name} progress={curr.progress} totalProblems={curr.totalProblems} content={curr.content}/>   
        ))}
    </div>
  );
}
