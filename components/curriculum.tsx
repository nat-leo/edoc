"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProblemCard } from "@/components/problem-card";
import { Curriculum as CurriculumItem, loadCurriculums } from "@/lib/curriculum";

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
      {curriculums.map((curriculum) => {
        const categoryHref = `/curriculum/${encodeURIComponent(curriculum.name.toLowerCase())}`;

        return (
          <ProblemCard
            key={curriculum.name}
            title={curriculum.name}
            description={`${curriculum.progress} / ${curriculum.totalProblems} Problems`}
            content={<p>{curriculum.content || "No description available yet."}</p>}
            actions={
              <div className="grid w-full grid-cols-2 gap-2">
                <Button asChild>
                  <Link href={categoryHref}>Learn</Link>
                </Button>
                <Button variant="secondary">Test</Button>
              </div>
            }
            titleClassName="text-xl"
          />
        );
      })}
    </div>
  );
}
