import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ContributionActivityMonitor } from "@/components/contribution-activity-monitor";

describe("ContributionActivityMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the current month as the final month header in the last-year calendar", () => {
    const { container } = render(<ContributionActivityMonitor days={[]} />);

    expect(screen.getByText("0 contributions in the last year")).toBeInTheDocument();

    const monthHeaderRow = container.querySelector(".grid.grid-cols-13");
    expect(monthHeaderRow).not.toBeNull();

    const monthHeaders = Array.from(monthHeaderRow!.children).map(
      (node) => node.textContent?.trim() ?? ""
    );

    expect(monthHeaders.at(-1)).toBe("Apr");
  });

  it.each([
    "2026-04-01T12:00:00",
    "2026-04-02T12:00:00",
    "2026-04-03T12:00:00",
    "2026-04-04T12:00:00",
    "2026-04-05T12:00:00",
  ])(
    "places the April header in the same week column as the rendered April 1 date when today is %s",
    (isoDate) => {
      vi.setSystemTime(new Date(isoDate));

      const { container } = render(
        <ContributionActivityMonitor
          days={[
            {
              date: "2026-04-01",
              submissions: 1,
              logins: 0,
            },
          ]}
        />
      );

      const scrollRegion = container.querySelector(".overflow-x-auto") as HTMLDivElement | null;
      expect(scrollRegion).not.toBeNull();

      const scrollCanvas = scrollRegion!.firstElementChild as HTMLDivElement | null;
      expect(scrollCanvas).not.toBeNull();

      const monthHeaderRow = scrollCanvas!.firstElementChild as HTMLDivElement | null;
      expect(monthHeaderRow).not.toBeNull();

      const weekColumns = Array.from(scrollCanvas!.lastElementChild?.children ?? []);
      expect(weekColumns).toHaveLength(53);

      const currentWeekCells = screen.getAllByLabelText(/Week 53, day \d, level \d/);
      let aprilFirstCell: HTMLElement | null = null;

      for (const cell of currentWeekCells) {
        fireEvent.pointerEnter(cell);
        fireEvent.mouseEnter(cell);
        act(() => {
          vi.advanceTimersByTime(81);
        });

        if (screen.queryByText("1 contribution on April 1.")) {
          aprilFirstCell = cell as HTMLElement;
          break;
        }

        fireEvent.pointerLeave(cell);
        fireEvent.mouseLeave(cell);
        act(() => {
          vi.advanceTimersByTime(41);
        });
      }

      expect(aprilFirstCell).not.toBeNull();

      const aprilFirstWeekColumn = aprilFirstCell!.parentElement;
      expect(aprilFirstWeekColumn).not.toBeNull();
      expect(weekColumns).toContain(aprilFirstWeekColumn!);

      const aprilWeekColumnIndex = weekColumns.indexOf(aprilFirstWeekColumn!);
      expect(aprilWeekColumnIndex).toBeGreaterThanOrEqual(0);

      const monthHeaderCells = Array.from(monthHeaderRow!.children) as HTMLElement[];
      const aprilHeaderIndexes = monthHeaderCells.flatMap((cell, index) =>
        cell.textContent?.trim() === "Apr" ? [index] : []
      );

      expect(monthHeaderCells[aprilWeekColumnIndex]).toBeDefined();
      expect(monthHeaderCells[aprilWeekColumnIndex]).toHaveTextContent("Apr");
      expect(aprilHeaderIndexes).toEqual([aprilWeekColumnIndex]);
    }
  );

  it("initially scrolls the activity grid so today's cells are visible", () => {
    const { container } = render(<ContributionActivityMonitor days={[]} />);

    const scrollRegion = container.querySelector(".overflow-x-auto") as HTMLDivElement | null;
    expect(scrollRegion).not.toBeNull();

    expect(screen.getByLabelText("Week 53, day 3, level 0")).toBeInTheDocument();
    expect(screen.queryByLabelText("Week 53, day 4, level 0")).not.toBeInTheDocument();

    Object.defineProperty(scrollRegion!, "clientWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(scrollRegion!, "scrollWidth", {
      configurable: true,
      value: 1160,
    });

    expect(scrollRegion!.scrollWidth).toBeGreaterThan(scrollRegion!.clientWidth);
    expect(scrollRegion!.scrollLeft).toBe(scrollRegion!.scrollWidth - scrollRegion!.clientWidth);
  });

  it("keeps the Mon, Wed, Fri labels pinned while the activity grid scrolls", () => {
    const { container } = render(<ContributionActivityMonitor days={[]} />);

    const scrollRegion = container.querySelector(".overflow-x-auto") as HTMLDivElement | null;
    expect(scrollRegion).not.toBeNull();

    const monLabel = screen.getByText("Mon");
    const wedLabel = screen.getByText("Wed");
    const friLabel = screen.getByText("Fri");
    const dayLabelColumn = monLabel.parentElement;

    expect(dayLabelColumn).not.toBeNull();
    expect(dayLabelColumn).toHaveClass("sticky", "left-0");

    Object.defineProperty(scrollRegion!, "scrollLeft", {
      configurable: true,
      writable: true,
      value: 0,
    });

    scrollRegion!.scrollLeft = 420;
    fireEvent.scroll(scrollRegion!);

    expect(scrollRegion!.scrollLeft).toBe(420);
    expect(dayLabelColumn).toHaveClass("sticky", "left-0");
    expect(monLabel).toBeVisible();
    expect(wedLabel).toBeVisible();
    expect(friLabel).toBeVisible();
  });

  it("renders a Wednesday contribution in the same row as the Wed label", () => {
    render(
      <ContributionActivityMonitor
        days={[
          {
            date: "2026-04-01",
            submissions: 1,
            logins: 0,
          },
        ]}
      />
    );

    const wedLabel = screen.getByText("Wed");
    const dayLabelColumn = wedLabel.parentElement?.parentElement;
    expect(dayLabelColumn).not.toBeNull();

    const wedRowIndex = Array.from(dayLabelColumn!.children).indexOf(wedLabel.parentElement!);
    expect(wedRowIndex).toBeGreaterThanOrEqual(0);

    const lastWeekCells = screen.getAllByLabelText(/Week 53, day \d, level \d/);
    expect(lastWeekCells).toHaveLength(3);

    const contributionCell = lastWeekCells.find((cell) =>
      cell.getAttribute("aria-label")?.endsWith("level 1")
    );

    expect(contributionCell).toBeDefined();
    expect(lastWeekCells.indexOf(contributionCell!)).toBe(wedRowIndex);
  });

  it("keeps the weekday column outside the horizontally scrolling heatmap content", () => {
    const { container } = render(<ContributionActivityMonitor days={[]} />);

    const scrollRegion = container.querySelector(".overflow-x-auto") as HTMLDivElement | null;
    expect(scrollRegion).not.toBeNull();

    const scrollFrame = scrollRegion!.parentElement;
    expect(scrollFrame).not.toBeNull();

    const monLabel = screen.getByText("Mon");
    const dayLabelColumn = monLabel.parentElement;
    const firstHeatmapCell = screen.getByLabelText("Week 1, day 1, level 0");

    expect(dayLabelColumn).not.toBeNull();
    expect(scrollFrame).toContainElement(dayLabelColumn!);
    expect(scrollRegion).not.toContainElement(dayLabelColumn!);
    expect(scrollRegion).toContainElement(firstHeatmapCell);
  });

  it("stops the visible cells at today instead of rendering through the end of the week", () => {
    render(<ContributionActivityMonitor days={[]} />);

    const visibleCellsInLastWeek = screen.getAllByLabelText(/Week 53, day \d, level \d/);

    expect(visibleCellsInLastWeek).toHaveLength(3);
    expect(screen.getByLabelText("Week 53, day 3, level 0")).toBeInTheDocument();
    expect(screen.queryByLabelText("Week 53, day 4, level 0")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Week 53, day 5, level 0")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Week 53, day 6, level 0")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Week 53, day 7, level 0")).not.toBeInTheDocument();
  });
});
