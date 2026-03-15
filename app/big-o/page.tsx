"use client";

import { useEffect, useState } from "react";

import { BigOPathCard, type BigOType } from "@/components/ui/big-o-path-card";

const X_VALUES = [2, 4, 8, 16, 32, 64, 128, 256] as const;
const DEFAULT_CARD_TYPES: BigOType[] = ["O(1)", "O(n)", "O(n^2)"];

type BigOPredictResponse = {
  big_o?: string;
};

function normalizeBigOType(value: unknown): BigOType {
  if (value === "O(1)" || value === "O(n)" || value === "O(n^2)") {
    return value;
  }
  return "O(n)";
}

function generateLinearSeries(xs: readonly number[]) {
  // Each invocation gets its own random linear model: y = m*x + b
  const slope = Math.floor(Math.random() * 9) + 1;
  const bias = Math.floor(Math.random() * 41) - 20;
  return xs.map((x) => slope * x + bias);
}

async function requestBigO(series: number[]): Promise<BigOType> {
  const res = await fetch("/api/big-o", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      series,
      return_diagnostics: false,
      output: "prob",
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as BigOPredictResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Prediction request failed (${res.status})`);
  }

  return normalizeBigOType(json.big_o);
}

export default function Page() {
  const [cardTypes, setCardTypes] = useState<BigOType[]>(DEFAULT_CARD_TYPES);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPredictions() {
      try {
        setError(null);

        const predictions = await Promise.all(
          Array.from({ length: 3 }, async () => {
            const series = generateLinearSeries(X_VALUES);
            return requestBigO(series);
          })
        );

        if (!active) return;
        setCardTypes(predictions);
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to fetch Big O predictions");
        }
      }
    }

    void loadPredictions();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cardTypes.map((type, index) => (
          <BigOPathCard key={index} type={type} className="h-[260px]" />
        ))}
      </div>
    </div>
  );
}
