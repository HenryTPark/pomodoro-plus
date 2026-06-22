"use client";

import React, { useMemo } from "react";
import { useSessionHistoryStore, type TimerMode } from "@/store";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeFilter = "all" | "today" | "7d" | "30d";

export const rangeOptions: { value: RangeFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

export function getRangeCutoff(range: RangeFilter): number {
  switch (range) {
    case "today": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    case "7d":
      return Date.now() - 7 * DAY_MS;
    case "30d":
      return Date.now() - 30 * DAY_MS;
    case "all":
    default:
      return 0;
  }
}

const cardClassName =
  "rounded-2xl border border-border bg-card/70 dark:shadow-2xl dark:shadow-slate-950/30 backdrop-blur-xl";

const modeMeta: Record<
  TimerMode,
  { label: string; color: string; textClass: string }
> = {
  focus: {
    label: "Focus",
    color: "var(--timer-focus)",
    textClass: "text-timer-focus",
  },
  break: {
    label: "Break",
    color: "var(--timer-break)",
    textClass: "text-timer-break",
  },
  longBreak: {
    label: "Long Break",
    color: "var(--timer-long-break)",
    textClass: "text-timer-long-break",
  },
};

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function currentDayStart(): number {
  return startOfDay(Date.now());
}

function formatMinutes(totalMinutes: number): string {
  const rounded = Number.isFinite(totalMinutes) ? Math.round(totalMinutes) : 0;
  if (rounded <= 0) return "0m";
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

interface HistoryDashboardProps {
  range: RangeFilter;
}

interface TimedContribution {
  timestamp: number;
  mode: TimerMode;
  minutes: number;
}

export default function HistoryDashboard({ range }: HistoryDashboardProps) {
  const { completedSessions, skippedSessions } = useSessionHistoryStore();

  // Real time contributions, grouped per category. Completed and skipped
  // sessions contribute their actual active (unpaused) duration. Extended
  // sessions are excluded because their time is already counted within the
  // session's recorded duration.
  const contributions = useMemo<TimedContribution[]>(() => {
    const cutoff = getRangeCutoff(range);
    const items: TimedContribution[] = [];

    for (const session of completedSessions) {
      if (session.timestamp < cutoff) continue;
      items.push({
        timestamp: session.timestamp,
        mode: session.mode,
        minutes: session.durationSeconds / 60,
      });
    }

    for (const session of skippedSessions) {
      if (session.timestamp < cutoff) continue;
      items.push({
        timestamp: session.timestamp,
        mode: session.mode,
        minutes: session.durationSeconds / 60,
      });
    }

    return items;
  }, [completedSessions, skippedSessions, range]);

  const categoryMinutes = useMemo(() => {
    const totals: Record<TimerMode, number> = {
      focus: 0,
      break: 0,
      longBreak: 0,
    };
    for (const item of contributions) {
      totals[item.mode] += item.minutes;
    }
    return totals;
  }, [contributions]);

  const stats = useMemo(() => {
    const cutoff = getRangeCutoff(range);
    const completedInRange = completedSessions.filter(
      (session) => session.timestamp >= cutoff,
    );
    const skippedInRange = skippedSessions.filter(
      (session) => session.timestamp >= cutoff,
    );

    const completedFocus = completedInRange.filter(
      (session) => session.mode === "focus",
    ).length;

    const totalAttempts = completedInRange.length + skippedInRange.length;
    const completionRate =
      totalAttempts === 0
        ? null
        : Math.round((completedInRange.length / totalAttempts) * 100);

    return {
      completedFocus,
      focusMinutes: categoryMinutes.focus,
      completionRate,
    };
  }, [completedSessions, skippedSessions, categoryMinutes, range]);

  // Streak is an all-time concept, so it intentionally ignores the range.
  const streak = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    const days = new Set<number>();
    for (const session of completedSessions) {
      days.add(startOfDay(session.timestamp));
    }

    const today = currentDayStart();
    let cursor = today;
    if (!days.has(today)) {
      cursor = today - DAY_MS;
      if (!days.has(cursor)) return 0;
    }

    let count = 0;
    while (days.has(cursor)) {
      count += 1;
      cursor -= DAY_MS;
    }
    return count;
  }, [completedSessions]);

  const histogram = useMemo(() => {
    return buildHistogram(range, contributions);
  }, [range, contributions]);

  const totalCategoryMinutes =
    categoryMinutes.focus + categoryMinutes.break + categoryMinutes.longBreak;

  return (
    <div className="grid shrink-0 gap-[clamp(0.5rem,1.4vh,0.875rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-[clamp(0.5rem,1.4vh,0.875rem)]">
        <div className="grid grid-cols-2 gap-[clamp(0.5rem,1.4vh,0.875rem)] sm:grid-cols-4">
          <StatCard
            label="Focus sessions"
            value={String(stats.completedFocus)}
          />
          <StatCard
            label="Focus time"
            value={formatMinutes(stats.focusMinutes)}
          />
          <StatCard
            label="Day streak"
            value={String(streak)}
            hint={streak === 1 ? "day" : "days"}
          />
          <StatCard
            label="Completion"
            value={
              stats.completionRate === null ? "--" : `${stats.completionRate}%`
            }
          />
        </div>

        <ActivityHistogram buckets={histogram} />
      </div>

      <CategoryDonut
        categoryMinutes={categoryMinutes}
        total={totalCategoryMinutes}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className={`${cardClassName} flex flex-col justify-center gap-0.5 p-[clamp(0.625rem,1.6vh,1rem)]`}
    >
      <span className="text-[clamp(0.65rem,1.3vh,0.78rem)] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[clamp(1.25rem,2.8vh,1.85rem)] font-semibold leading-none text-foreground">
          {value}
        </span>
        {hint ? (
          <span className="text-[clamp(0.65rem,1.3vh,0.8rem)] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

interface HistogramBucket {
  key: number;
  label: string;
  showLabel: boolean;
  minutes: number;
  fullLabel: string;
}

function ActivityHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  const maxMinutes = Math.max(...buckets.map((bucket) => bucket.minutes), 0);
  const hasData = maxMinutes > 0;
  const chartHeight = 100;
  const slot = 100 / Math.max(buckets.length, 1);
  const barWidth = slot * 0.62;
  const barOffset = (slot - barWidth) / 2;

  return (
    <div className={`${cardClassName} flex flex-1 flex-col p-[clamp(0.75rem,1.8vh,1.125rem)]`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[clamp(0.85rem,1.7vh,1rem)] font-semibold text-foreground">
          Focus activity
        </h3>
        <span className="text-[clamp(0.65rem,1.3vh,0.78rem)] text-muted-foreground">
          minutes
        </span>
      </div>

      {hasData ? (
        <div className="mt-[clamp(0.5rem,1.4vh,0.875rem)] flex flex-1 flex-col">
          <svg
            className="h-[clamp(4.5rem,11vh,7rem)] w-full overflow-visible"
            viewBox={`0 0 100 ${chartHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Focus minutes per period"
          >
            {buckets.map((bucket, index) => {
              const height =
                bucket.minutes > 0
                  ? Math.max((bucket.minutes / maxMinutes) * chartHeight, 1.5)
                  : 0;
              const x = index * slot + barOffset;
              return (
                <rect
                  key={bucket.key}
                  x={`${x}%`}
                  y={chartHeight - height}
                  width={`${barWidth}%`}
                  height={height}
                  rx="1.5"
                  fill="var(--timer-focus)"
                  opacity={bucket.minutes > 0 ? 0.9 : 0.18}
                >
                  <title>{`${bucket.fullLabel}: ${formatMinutes(bucket.minutes)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="mt-1 flex w-full justify-between text-[clamp(0.6rem,1.1vh,0.72rem)] text-muted-foreground">
            {buckets.map((bucket) => (
              <span
                key={bucket.key}
                className="flex-1 text-center"
                style={{ visibility: bucket.showLabel ? "visible" : "hidden" }}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-[clamp(1rem,3vh,2rem)]">
          <p className="text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
            No focus time in this range yet.
          </p>
        </div>
      )}
    </div>
  );
}

function CategoryDonut({
  categoryMinutes,
  total,
}: {
  categoryMinutes: Record<TimerMode, number>;
  total: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const order: TimerMode[] = ["focus", "break", "longBreak"];

  let accumulated = 0;
  const segments = order.map((mode) => {
    const value = categoryMinutes[mode];
    const fraction = total > 0 ? value / total : 0;
    const dash = fraction * circumference;
    const offset = accumulated;
    accumulated += dash;
    return { mode, value, fraction, dash, offset };
  });

  return (
    <div className={`${cardClassName} flex flex-col p-[clamp(0.75rem,1.8vh,1.125rem)]`}>
      <h3 className="text-[clamp(0.85rem,1.7vh,1rem)] font-semibold text-foreground">
        Time split
      </h3>

      {total > 0 ? (
        <div className="mt-[clamp(0.5rem,1.4vh,0.875rem)] flex flex-1 items-center gap-[clamp(0.75rem,2vw,1.25rem)]">
          <div className="relative shrink-0">
            <svg
              className="h-[clamp(5rem,13vh,7.5rem)] w-[clamp(5rem,13vh,7.5rem)] -rotate-90"
              viewBox="0 0 100 100"
              role="img"
              aria-label="Time split by mode"
            >
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--timer-track)"
                strokeWidth="14"
              />
              {segments.map((segment) =>
                segment.dash > 0 ? (
                  <circle
                    key={segment.mode}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={modeMeta[segment.mode].color}
                    strokeWidth="14"
                    strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                    strokeDashoffset={-segment.offset}
                    strokeLinecap="butt"
                  >
                    <title>{`${modeMeta[segment.mode].label}: ${formatMinutes(segment.value)}`}</title>
                  </circle>
                ) : null,
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[clamp(0.85rem,2vh,1.15rem)] font-semibold leading-none text-foreground">
                {formatMinutes(total)}
              </span>
              <span className="text-[clamp(0.6rem,1.1vh,0.72rem)] text-muted-foreground">
                total
              </span>
            </div>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-[clamp(0.25rem,0.9vh,0.5rem)]">
            {segments.map((segment) => (
              <li
                key={segment.mode}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: modeMeta[segment.mode].color }}
                  />
                  <span className="truncate text-[clamp(0.75rem,1.5vh,0.9rem)] text-foreground">
                    {modeMeta[segment.mode].label}
                  </span>
                </span>
                <span className="shrink-0 text-[clamp(0.7rem,1.4vh,0.85rem)] text-muted-foreground">
                  {Math.round(segment.fraction * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-[clamp(1rem,3vh,2rem)]">
          <p className="text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
            No time tracked in this range yet.
          </p>
        </div>
      )}
    </div>
  );
}

function buildHistogram(
  range: RangeFilter,
  contributions: TimedContribution[],
): HistogramBucket[] {
  const focusContributions = contributions.filter(
    (item) => item.mode === "focus",
  );

  if (range === "today") {
    const start = startOfDay(Date.now());
    const buckets: HistogramBucket[] = Array.from({ length: 24 }, (_, hour) => ({
      key: hour,
      label: `${hour}`,
      showLabel: hour % 6 === 0,
      minutes: 0,
      fullLabel: `${hour}:00`,
    }));
    for (const item of focusContributions) {
      const hour = new Date(item.timestamp).getHours();
      if (item.timestamp >= start) {
        buckets[hour].minutes += item.minutes;
      }
    }
    return buckets;
  }

  let dayCount: number;
  if (range === "7d") {
    dayCount = 7;
  } else if (range === "30d") {
    dayCount = 30;
  } else {
    const earliest = focusContributions.reduce(
      (min, item) => Math.min(min, item.timestamp),
      Date.now(),
    );
    const spanDays =
      Math.floor((startOfDay(Date.now()) - startOfDay(earliest)) / DAY_MS) + 1;
    dayCount = Math.min(Math.max(spanDays, 1), 90);
  }

  const todayStart = startOfDay(Date.now());
  const firstDay = todayStart - (dayCount - 1) * DAY_MS;
  const indexByDay = new Map<number, number>();
  const labelEvery = Math.max(1, Math.ceil(dayCount / 7));

  const buckets: HistogramBucket[] = Array.from(
    { length: dayCount },
    (_, index) => {
      const dayStart = firstDay + index * DAY_MS;
      indexByDay.set(dayStart, index);
      const date = new Date(dayStart);
      const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
      const numeric = date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const showLabel =
        index === dayCount - 1 || (dayCount - 1 - index) % labelEvery === 0;
      return {
        key: dayStart,
        label: dayCount <= 7 ? weekday : `${date.getDate()}`,
        showLabel,
        minutes: 0,
        fullLabel: numeric,
      };
    },
  );

  for (const item of focusContributions) {
    const dayStart = startOfDay(item.timestamp);
    const index = indexByDay.get(dayStart);
    if (index !== undefined) {
      buckets[index].minutes += item.minutes;
    }
  }

  return buckets;
}
