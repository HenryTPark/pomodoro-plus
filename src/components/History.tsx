"use client";

import React, { useMemo, useState } from "react";
import { useSessionHistoryStore, type TimerMode } from "@/store";
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

type HistoryEventType = "completed" | "skipped" | "extended";

type EventTypeFilter = "all" | HistoryEventType;
type ModeFilter = "all" | TimerMode;

interface HistoryEntry {
  id: string;
  type: HistoryEventType;
  mode: TimerMode;
  templateLabel: string;
  timestamp: number;
  minutesAdded?: number;
}

const modeLabels: Record<TimerMode, string> = {
  focus: "Focus",
  break: "Break",
  longBreak: "Long Break",
};

const eventStyles: Record<HistoryEventType, { label: string; className: string }> = {
  completed: { label: "Completed", className: "text-timer-break" },
  skipped: { label: "Skipped", className: "text-muted-foreground" },
  extended: { label: "Extended", className: "text-timer-long-break" },
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function History() {
  const { completedSessions, skippedSessions, extendedSessions } =
    useSessionHistoryStore();

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<EventTypeFilter>("all");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [template, setTemplate] = useState<string>("all");
  const [range, setRange] = useState<RangeFilter>("all");

  const allEntries = useMemo<HistoryEntry[]>(() => {
    const merged: HistoryEntry[] = [
      ...completedSessions.map((session) => ({
        id: session.id,
        type: "completed" as const,
        mode: session.mode,
        templateLabel: session.templateLabel,
        timestamp: session.timestamp,
      })),
      ...skippedSessions.map((session) => ({
        id: session.id,
        type: "skipped" as const,
        mode: session.mode,
        templateLabel: session.templateLabel,
        timestamp: session.timestamp,
      })),
      ...extendedSessions.map((session) => ({
        id: session.id,
        type: "extended" as const,
        mode: session.mode,
        templateLabel: session.templateLabel,
        timestamp: session.timestamp,
        minutesAdded: session.minutesAdded,
      })),
    ];

    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [completedSessions, skippedSessions, extendedSessions]);

  const templateOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const entry of allEntries) {
      labels.add(entry.templateLabel);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [allEntries]);

  const entries = useMemo<HistoryEntry[]>(() => {
    const cutoff = getRangeCutoff(range);
    const query = search.trim().toLowerCase();

    return allEntries.filter((entry) => {
      if (entry.timestamp < cutoff) return false;
      if (eventType !== "all" && entry.type !== eventType) return false;
      if (mode !== "all" && entry.mode !== mode) return false;
      if (template !== "all" && entry.templateLabel !== template) return false;
      if (query) {
        const haystack =
          `${entry.templateLabel} ${modeLabels[entry.mode]}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [allEntries, range, eventType, mode, template, search]);

  const hasHistory = allEntries.length > 0;
  const hasResults = entries.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-2 py-3 text-foreground sm:px-3">
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
                value={eventType}
                onValueChange={(value) =>
                  setEventType(value as EventTypeFilter)
                }
              >
                <SelectTrigger className="w-full cursor-pointer sm:w-36" size="sm">
                  <SelectValue placeholder="Event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="extended">Extended</SelectItem>
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
              {entries.map((entry) => {
                const event = eventStyles[entry.type];
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-[clamp(0.5rem,1.2vh,0.875rem)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`min-w-[5.5rem] shrink-0 text-[clamp(0.75rem,1.5vh,0.9rem)] font-semibold uppercase tracking-wide ${event.className}`}
                      >
                        {event.label}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[clamp(0.9rem,1.8vh,1.05rem)] font-medium text-foreground">
                          {modeLabels[entry.mode]}
                          {entry.type === "extended" &&
                          entry.minutesAdded !== undefined
                            ? ` · +${entry.minutesAdded} min`
                            : ""}
                        </p>
                        <p className="truncate text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                          {entry.templateLabel}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
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
