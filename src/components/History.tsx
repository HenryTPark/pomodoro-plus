"use client";

import React, { useMemo, useState } from "react";
import {
  useSessionHistoryStore,
  type SessionRecord,
  type TimerMode,
} from "@/store";
import { formatDuration } from "@/lib/sessionHistory";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import HistoryDashboard, {
  getRangeCutoff,
  rangeOptions,
  type RangeFilter,
} from "@/components/HistoryDashboard";

const cardClassName =
  "rounded-2xl border border-border bg-card/70 dark:shadow-2xl dark:shadow-slate-950/30 backdrop-blur-xl";

type SessionOutcome = SessionRecord["outcome"];
type OutcomeFilter = "all" | SessionOutcome;
type ExtendedFilter = "all" | "extended";
type ModeFilter = "all" | TimerMode;

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
  break: "Break",
  longBreak: "Long Break",
};

const outcomeStyles: Record<
  SessionOutcome,
  { label: string; className: string }
> = {
  completed: { label: "Completed", className: "text-timer-break" },
  skipped: { label: "Skipped", className: "text-muted-foreground" },
  stopped: { label: "Stopped", className: "text-timer-long-break" },
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPrimaryLine(session: SessionRecord) {
  const mode = modeLabels[session.mode];
  const duration = formatDuration(session.durationSeconds);

  // plannedSeconds === 0 means unknown (legacy); do not treat as a real target
  if (session.plannedSeconds > 0) {
    return `${mode} · ${duration} of ${formatDuration(session.plannedSeconds)}`;
  }

  return `${mode} · ${duration}`;
}

function formatSecondaryLine(session: SessionRecord) {
  const parts = [session.templateLabel];

  if (session.extensionCount > 0) {
    parts.push(
      `Extended ${session.extensionCount}× (+${session.minutesExtended} min)`,
    );
  }

  if (session.pauseCount > 0) {
    parts.push(`Paused ${session.pauseCount}×`);
  }

  return parts.join(" · ");
}

export default function History() {
  const sessions = useSessionHistoryStore((state) => state.sessions);

  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [extended, setExtended] = useState<ExtendedFilter>("all");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [template, setTemplate] = useState<string>("all");
  const [range, setRange] = useState<RangeFilter>("all");

  const templateOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const session of sessions) {
      labels.add(session.templateLabel);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const entries = useMemo(() => {
    const cutoff = getRangeCutoff(range);
    const query = search.trim().toLowerCase();

    return sessions.filter((session) => {
      if (session.timestamp < cutoff) return false;
      if (outcome !== "all" && session.outcome !== outcome) return false;
      if (extended === "extended" && session.extensionCount === 0) return false;
      if (mode !== "all" && session.mode !== mode) return false;
      if (template !== "all" && session.templateLabel !== template) return false;
      if (query) {
        const haystack =
          `${session.templateLabel} ${modeLabels[session.mode]} ${session.outcome}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [sessions, range, outcome, extended, mode, template, search]);

  const hasHistory = sessions.length > 0;
  const hasResults = entries.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-2 py-3 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] text-foreground sm:px-3">
      <div className="flex min-h-full w-full max-w-[min(100vw-1rem,72rem)] flex-col gap-[clamp(0.625rem,1.6vh,1.125rem)]">
        <section
          className={`${cardClassName} flex flex-col p-[clamp(0.875rem,2.2vh,1.5rem)]`}
        >
          <div className="shrink-0 space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
                Session History
              </h2>
              {hasHistory ? (
                <span className="shrink-0 text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                  {entries.length}{" "}
                  {entries.length === 1 ? "session" : "sessions"}
                </span>
              ) : null}
            </div>
            <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
              Your recent focus and break sessions.
            </p>
          </div>

          {hasHistory ? (
            <div className="mt-[clamp(0.5rem,1.5vh,1rem)] flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search template or mode..."
                aria-label="Search sessions"
                className="h-8 w-full sm:w-56"
              />

              <Select
                value={outcome}
                onValueChange={(value) => setOutcome(value as OutcomeFilter)}
              >
                <SelectTrigger className="w-full cursor-pointer sm:w-36" size="sm">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={extended}
                onValueChange={(value) =>
                  setExtended(value as ExtendedFilter)
                }
              >
                <SelectTrigger className="w-full cursor-pointer sm:w-36" size="sm">
                  <SelectValue placeholder="Extensions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any extensions</SelectItem>
                  <SelectItem value="extended">Extended only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={mode}
                onValueChange={(value) => setMode(value as ModeFilter)}
              >
                <SelectTrigger className="w-full cursor-pointer sm:w-36" size="sm">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="focus">Focus</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                  <SelectItem value="longBreak">Long Break</SelectItem>
                </SelectContent>
              </Select>

              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="w-full cursor-pointer sm:w-44" size="sm">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All templates</SelectItem>
                  {templateOptions.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 sm:ml-auto">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={range === option.value ? "secondary" : "ghost"}
                    onClick={() => setRange(option.value)}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {hasHistory ? (
            <div className="mt-[clamp(0.5rem,1.5vh,1rem)]">
              <HistoryDashboard range={range} />
            </div>
          ) : null}

          {!hasHistory ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                No sessions yet. Start a timer to build your history.
              </p>
            </div>
          ) : !hasResults ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                No sessions match these filters.
              </p>
            </div>
          ) : (
            <ul className="mt-[clamp(0.5rem,1.5vh,1rem)] divide-y divide-border pr-2 sm:pr-3">
              {entries.map((session) => {
                const style = outcomeStyles[session.outcome];
                return (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-[clamp(0.5rem,1.2vh,0.875rem)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`min-w-22 shrink-0 text-[clamp(0.75rem,1.5vh,0.9rem)] font-semibold uppercase tracking-wide ${style.className}`}
                      >
                        {style.label}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[clamp(0.9rem,1.8vh,1.05rem)] font-medium text-foreground">
                          {formatPrimaryLine(session)}
                        </p>
                        <p className="truncate text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                          {formatSecondaryLine(session)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                      {formatTimestamp(session.timestamp)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
