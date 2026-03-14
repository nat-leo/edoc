"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Curriculum as CurriculumItem, loadCurriculums } from "@/lib/curriculum";

export function CurriculumCard({ name, totalProblems, progress, content }: CurriculumItem) {
  const categoryHref = `/curriculum/${encodeURIComponent(name.toLowerCase())}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          {progress} / {totalProblems} Problems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{content || "No description available yet."}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <Link href={categoryHref}>Learn</Link>
          </Button>
          <Button variant="secondary">Test</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function Curriculum() {
  const [curriculums, setCurriculums] = useState<CurriculumItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setIsLoading(true);
        const items = await loadCurriculums({ signal: controller.signal });
        setCurriculums(items);
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

    void load();
    return () => controller.abort();
  }, []);

  if (isLoading) {
    return <p>Loading curriculum...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {curriculums.map((curriculum) => (
        <CurriculumCard
          key={curriculum.name}
          name={curriculum.name}
          progress={curriculum.progress}
          totalProblems={curriculum.totalProblems}
          content={curriculum.content}
        />
      ))}
    </div>
  );
}
