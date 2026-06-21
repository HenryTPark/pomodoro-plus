"use client";

import React, { useMemo } from "react";
import { useSessionHistoryStore, type TimerMode } from "@/store";

const cardClassName =
  "rounded-2xl border border-border bg-card/70 dark:shadow-2xl dark:shadow-slate-950/30 backdrop-blur-xl";

type HistoryEventType = "completed" | "skipped" | "extended";

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

  const entries = useMemo<HistoryEntry[]>(() => {
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

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-hidden px-2 py-3 text-foreground sm:px-3">
      <div className="flex h-full min-h-0 w-full max-w-[min(100vw-1rem,72rem)] flex-col gap-[clamp(0.625rem,1.6vh,1.125rem)]">
        <section
          className={`${cardClassName} flex min-h-0 flex-1 flex-col p-[clamp(0.875rem,2.2vh,1.5rem)]`}
        >
          <div className="shrink-0 space-y-1">
            <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
              Session History
            </h2>
            <p className="truncate text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
              Your recent focus and break sessions.
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                No sessions yet. Start a timer to build your history.
              </p>
            </div>
          ) : (
            <ul className="mt-[clamp(0.5rem,1.5vh,1rem)] min-h-0 flex-1 divide-y divide-border overflow-y-auto pr-2 sm:pr-3">
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
