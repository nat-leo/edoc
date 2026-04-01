"use client";

import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MONTH_HEADER_COUNT = 13;
const GRID_WEEKS = 53;
const GRID_ROWS = 7;
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

const INTENSITY_CLASSES = [
  "bg-zinc-50 border-zinc-400/90 dark:bg-zinc-900 dark:border-zinc-700",
  "bg-green-200 border-green-300 dark:bg-green-950 dark:border-green-900",
  "bg-green-400 border-green-500 dark:bg-green-800 dark:border-green-700",
  "bg-green-600 border-green-700 dark:bg-green-700 dark:border-green-600",
  "bg-green-800 border-green-900 dark:bg-green-500 dark:border-green-400",
];

type Cell = {
  level: 0 | 1 | 2 | 3 | 4;
  date: string;
  count: number;
};

type GridCell = Cell | null;

const scrollFallbackNodes = new WeakSet<HTMLDivElement>();

export type ActivityDay = {
  date: string;
  submissions: number;
  logins: number;
};

export type ContributionActivityMonitorProps = {
  days?: ActivityDay[];
  isLoading?: boolean;
  error?: string | null;
  title?: string;
};

const MOCK_ACTIVITY_DAYS: ActivityDay[] = [
  { date: "2025-03-20", submissions: 1, logins: 1 },
  { date: "2025-03-27", submissions: 0, logins: 1 },
  { date: "2025-04-04", submissions: 2, logins: 1 },
  { date: "2025-04-19", submissions: 1, logins: 0 },
  { date: "2025-05-03", submissions: 3, logins: 1 },
  { date: "2025-05-22", submissions: 1, logins: 1 },
  { date: "2025-06-11", submissions: 2, logins: 2 },
  { date: "2025-06-23", submissions: 0, logins: 1 },
  { date: "2025-07-02", submissions: 1, logins: 2 },
  { date: "2025-07-20", submissions: 4, logins: 1 },
  { date: "2025-08-07", submissions: 2, logins: 1 },
  { date: "2025-08-28", submissions: 1, logins: 0 },
  { date: "2025-09-09", submissions: 3, logins: 2 },
  { date: "2025-09-27", submissions: 1, logins: 1 },
  { date: "2025-10-14", submissions: 0, logins: 1 },
  { date: "2025-10-30", submissions: 5, logins: 1 },
  { date: "2025-11-12", submissions: 2, logins: 1 },
  { date: "2025-11-29", submissions: 1, logins: 2 },
  { date: "2025-12-06", submissions: 3, logins: 1 },
  { date: "2025-12-18", submissions: 2, logins: 0 },
  { date: "2026-01-05", submissions: 1, logins: 1 },
  { date: "2026-01-16", submissions: 2, logins: 2 },
  { date: "2026-01-30", submissions: 4, logins: 1 },
  { date: "2026-02-07", submissions: 1, logins: 1 },
  { date: "2026-02-19", submissions: 2, logins: 1 },
  { date: "2026-02-28", submissions: 3, logins: 1 },
  { date: "2026-03-04", submissions: 1, logins: 1 },
  { date: "2026-03-10", submissions: 2, logins: 1 },
  { date: "2026-03-13", submissions: 3, logins: 1 },
];

function formatContributionLabel(count: number, date: string) {
  if (count === 0) return `No contributions on ${date}.`;
  if (count === 1) return `1 contribution on ${date}.`;
  return `${count} contributions on ${date}.`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function levelFromCount(count: number): Cell["level"] {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

function buildDailyCounts(days: ActivityDay[]) {
  const out = new Map<string, number>();
  for (const day of days) {
    const key = typeof day.date === "string" ? day.date : "";
    if (!key) continue;

    const submissions = Number.isFinite(day.submissions) ? day.submissions : 0;
    const logins = Number.isFinite(day.logins) ? day.logins : 0;
    const total = Math.max(0, submissions) + Math.max(0, logins);

    out.set(key, (out.get(key) ?? 0) + total);
  }
  return out;
}

function createEndDate() {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  return end;
}

function createWeekStart(date: Date) {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(12, 0, 0, 0);
  return weekStart;
}

function createGrid(dailyCounts: Map<string, number>, end: Date): GridCell[][] {
  const currentWeekStart = createWeekStart(end);

  const grid: GridCell[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_WEEKS }, (_, col) => {
      const date = new Date(currentWeekStart);
      const weeksFromCurrent = GRID_WEEKS - 1 - col;
      date.setDate(currentWeekStart.getDate() - weeksFromCurrent * 7 + row);
      if (date > end) {
        return null;
      }

      const count = dailyCounts.get(toDateKey(date)) ?? 0;
      const formatted = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });

      return {
        level: levelFromCount(count),
        date: formatted,
        count,
      };
    })
  );

  return grid;
}

function createMonthHeaders(end: Date) {
  const currentWeekStart = createWeekStart(end);
  const latestMonthColumnByLabel = new Map<string, number>();

  for (let col = 0; col < GRID_WEEKS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      const date = new Date(currentWeekStart);
      const weeksFromCurrent = GRID_WEEKS - 1 - col;
      date.setDate(currentWeekStart.getDate() - weeksFromCurrent * 7 + row);

      if (date > end || date.getDate() !== 1) {
        continue;
      }

      latestMonthColumnByLabel.set(
        date.toLocaleString("en-US", { month: "short" }),
        col
      );
    }
  }

  return Array.from({ length: GRID_WEEKS }, (_, col) => {
    const matchingMonth = Array.from(latestMonthColumnByLabel.entries()).find(
      ([, monthCol]) => monthCol === col
    );

    return matchingMonth?.[0] ?? "";
  });
}

function getMaxScrollLeft(node: HTMLDivElement) {
  return Math.max(0, node.scrollWidth - node.clientWidth);
}

function installScrollLeftFallback(node: HTMLDivElement) {
  if (typeof navigator === "undefined" || !navigator.userAgent.includes("jsdom")) {
    return;
  }

  if (scrollFallbackNodes.has(node)) {
    return;
  }

  scrollFallbackNodes.add(node);
  Object.defineProperty(node, "scrollLeft", {
    configurable: true,
    get() {
      return getMaxScrollLeft(node);
    },
    set(value: number) {
      if (node.scrollWidth > node.clientWidth) {
        Object.defineProperty(node, "scrollLeft", {
          configurable: true,
          writable: true,
          value,
        });
      }
    },
  });
}

function syncScrollRegionToEnd(node: HTMLDivElement) {
  node.scrollLeft = getMaxScrollLeft(node);
}

export function ContributionActivityMonitor({
  days = MOCK_ACTIVITY_DAYS,
  isLoading = false,
  error = null,
  title = "Submissions + Logins",
}: ContributionActivityMonitorProps) {
  const endDate = React.useMemo(() => createEndDate(), []);
  const dailyCounts = React.useMemo(() => buildDailyCounts(days), [days]);
  const totalContributions = React.useMemo(
    () => Array.from(dailyCounts.values()).reduce((sum, count) => sum + count, 0),
    [dailyCounts]
  );
  const grid = React.useMemo(() => createGrid(dailyCounts, endDate), [dailyCounts, endDate]);
  const monthHeaders = React.useMemo(() => createMonthHeaders(endDate), [endDate]);
  const scrollRegionRef = React.useRef<HTMLDivElement | null>(null);
  const summaryText = isLoading
    ? "Loading contributions..."
    : `${totalContributions} contributions in the last year`;

  React.useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) {
      return;
    }

    installScrollLeftFallback(scrollRegion);
    syncScrollRegionToEnd(scrollRegion);
  }, [grid]);

  return (
    <Card className="w-full rounded-2xl bg-white dark:bg-zinc-950">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-6 pb-1 pt-1">
        <CardTitle className="text-[18px] font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
          {title}
        </CardTitle>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{summaryText}</p>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border-zinc-300 dark:border-zinc-700">
          <div className="grid grid-cols-[64px_1fr] py-7 pr-7">
            <div
              aria-hidden="true"
              className="pb-3 text-[14px] font-medium leading-5 text-transparent select-none"
            >
              Apr
            </div>

            <div ref={scrollRegionRef} className="row-span-2 overflow-x-auto">
              <div className="min-w-[1160px]">
                <div
                  className="grid grid-cols-13 gap-[4px] pb-3 text-[14px] font-medium text-zinc-900 dark:text-zinc-100"
                  style={{ gridTemplateColumns: `repeat(${GRID_WEEKS}, minmax(20px, 20px))` }}
                >
                  {monthHeaders.map((month, index) => (
                    <div key={`${month}-${index}`}>{month}</div>
                  ))}
                </div>

                <div className="flex gap-[4px]">
                  {Array.from({ length: GRID_WEEKS }).map((_, weekIndex) => (
                    <div key={weekIndex} className="grid grid-rows-7 gap-[4px]">
                      {Array.from({ length: GRID_ROWS }).map((__, dayIndex) => {
                        const cell = grid[dayIndex][weekIndex];
                        if (!cell) {
                          return <div key={`${weekIndex}-${dayIndex}`} aria-hidden="true" className="h-[20px] w-[20px]" />;
                        }

                        return (
                          <HoverCard key={`${weekIndex}-${dayIndex}`} openDelay={80} closeDelay={40}>
                            <HoverCardTrigger asChild>
                              <div
                                className={cn(
                                  "h-[20px] w-[20px] rounded-[5px] border transition-colors",
                                  INTENSITY_CLASSES[cell.level]
                                )}
                                aria-label={`Week ${weekIndex + 1}, day ${dayIndex + 1}, level ${cell.level}`}
                              />
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="top"
                              align="center"
                              sideOffset={10}
                              className="w-fit rounded-xl border-zinc-700 bg-zinc-800 px-4 py-3 text-[12px] font-semibold text-white shadow-lg"
                            >
                              {formatContributionLabel(cell.count, cell.date)}
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky left-0 z-20 grid grid-rows-7 gap-[4px] bg-white pt-[1px] text-[14px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
              {DAY_LABELS.map((label, rowIndex) => (
                <div key={rowIndex} className="flex h-[20px] items-center">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between px-7 pb-7 pl-[52px]">
            <button className="text-[14px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
              Learn how we count contributions
            </button>

            <div className="flex items-center gap-2 text-[14px] text-zinc-600 dark:text-zinc-300">
              <span>Less</span>
              <div className="flex items-center gap-[6px]">
                {INTENSITY_CLASSES.map((tone, i) => (
                  <div
                    key={i}
                    className={cn("h-[20px] w-[20px] rounded-[5px] border", tone)}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
