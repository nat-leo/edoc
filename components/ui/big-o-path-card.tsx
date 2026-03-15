"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type BigOType = "O(1)" | "O(n)" | "O(n^2)";

type Props = {
  type: BigOType;
  label?: string;              // defaults to O(n) / O(n^2)
  size?: number;               // px, square side length
  height?: number;             // deprecated alias for size
  className?: string;          // outer card sizing
  strokeWidth?: number;
  durationMs?: number;         // line draw duration
  delayLabelMs?: number;       // delay after line finishes
};


function makePath(type: BigOType, w: number, h: number) {
  const pad = 32;

  const x0 = pad;
  const x1 = w - pad;

  const yTop = pad;
  const yBot = h - pad;

  // Sampling count: enough to look smooth, not so many that it gets “hairy”.
  // This preserves that satisfying "single stroke drawing" feel with pathLength.
  const samples = 120;

  // --- 1) Choose function via if/else (extensible) ---
  // x is normalized to [0..1]
  const f = (x: number) => {
    if (type === "O(1)") return 1;                 // y = 1
    else if (type === "O(n)") return x + 1;        // y = x + 1
    else if (type === "O(n^2)") return x * x + 1;  // y = x^2 + 1
    else return 1;
  };

  // --- 2) Use a consistent y-range for these curves ---
  // On x∈[0,1]:
  //   O(1): y = 1
  //   O(n): y ∈ [1,2]
  //   O(n^2): y ∈ [1,2]
  // So we can fix yMin/yMax to [1,2] for consistent vertical scaling.
  const yMin = 1;
  const yMax = 2;
  const ySpan = yMax - yMin;

  const toX = (x01: number) => x0 + (x1 - x0) * x01;

  // Map math y in [1..2] to screen y in [yBot..yTop]
  // y=1 -> yBot (bottom), y=2 -> yTop (top)
  const toY = (y: number) => {
    const t = (y - yMin) / ySpan; // [0..1]
    const tc = Math.max(0, Math.min(1, t));
    return yBot + (yTop - yBot) * tc;
  };

  // --- 3) Build a single SVG path ---
  // (M + L segments)
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    const y = f(x);
    const X = toX(x);
    const Y = toY(y);
    d += i === 0 ? `M ${X} ${Y}` : ` L ${X} ${Y}`;
  }

  // --- 4) Endpoint for label placement (far right) ---
  const endPoint = { x: toX(1), y: toY(f(1)) };

  return { d, endPoint };
}

export function BigOPathCard({
  type,
  label,
  size,
  height,
  className,
  strokeWidth = 6,
  durationMs = 1100,
  delayLabelMs = 150,
}: Props) {
  const side = size ?? height ?? 240;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = React.useState({ w: side, h: side });

  React.useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const nextSide = Math.max(160, Math.min(rect.width, rect.height));
      setChartSize({ w: nextSide, h: nextSide });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shownLabel = label ?? type;          // what you display
  const bigO: BigOType = type;              // what drives the path

  const { d, endPoint } = React.useMemo(
    () => makePath(bigO, chartSize.w, chartSize.h),
    [type, chartSize.w, chartSize.h]
  );

  const lineDuration = durationMs / 1000;
  const labelDelay = (durationMs + delayLabelMs) / 1000;

  return (
    <Card
      ref={ref}
      className={cn(
        "relative aspect-square overflow-hidden rounded-2xl border bg-background p-0",
        className
      )}
      style={{ width: side, height: side }}
    >
      {/* Optional subtle background */}
      <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-background" />

      {/* SVG drawing area */}
      <svg
        className="relative h-full w-full"
        viewBox={`0 0 ${chartSize.w} ${chartSize.h}`}
        preserveAspectRatio="none"
      >
        {/* The path (drawn) */}
        <motion.path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.95 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: lineDuration,
            ease: "easeInOut",
          }}
        />

        {/* A dot at the endpoint (optional but looks nice) */}
        <motion.circle
          cx={endPoint.x}
          cy={endPoint.y}
          r={Math.max(3, strokeWidth * 0.65)}
          fill="currentColor"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: lineDuration * 0.85, duration: 0.25 }}
        />

        {/* Label that fades in near the endpoint */}
        <motion.g
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: labelDelay, duration: 0.35, ease: "easeOut" }}
        >
          <foreignObject
            x={Math.min(endPoint.x + 10, chartSize.w - 140)}
            y={Math.max(endPoint.y - 34, 8)}
            width={140}
            height={60}
          >
            <div className="flex items-center">
              <span className="rounded-xl bg-background/80 px-3 py-1 text-sm font-semibold backdrop-blur">
                {shownLabel}
              </span>
            </div>
          </foreignObject>
        </motion.g>
      </svg>
    </Card>
  );
}
