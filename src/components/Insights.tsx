"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  ApiError,
  type ApiInsightRequest,
  type InsightApiErrorBody,
  type InsightRangeKey,
  type InsightResult,
  insightsApi,
} from "@/lib/api";
import { useInsight } from "@/hooks/useInsight";
import { useAuthStore } from "@/store/authStore";
import { useSessionHistoryStore } from "@/store";
import { Button } from "@/components/ui/button";
import AuthControls from "@/components/AuthControls";

const MIN_COMPLETED_FOCUS_SESSIONS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const cardClassName =
  "rounded-2xl border border-border bg-card/70 dark:shadow-2xl dark:shadow-slate-950/30 backdrop-blur-xl";

const rangeOptions: { value: InsightRangeKey; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

function getRangeCutoff(range: InsightRangeKey): number {
  switch (range) {
    case "7d":
      return Date.now() - 7 * DAY_MS;
    case "30d":
      return Date.now() - 30 * DAY_MS;
    case "all":
    default:
      return 0;
  }
}

function countCompletedFocusSessions(
  sessions: ReturnType<typeof useSessionHistoryStore.getState>["sessions"],
  range: InsightRangeKey,
): number {
  const cutoff = getRangeCutoff(range);
  return sessions.filter(
    (session) =>
      session.timestamp >= cutoff &&
      session.outcome === "completed" &&
      session.mode === "focus",
  ).length;
}

function mapInsightError(errorCode: string | null | undefined): string {
  switch (errorCode) {
    case "keep_tracking":
      return "Complete more focus sessions in this range before generating insights.";
    case "daily_quota_exceeded":
      return "Daily insight limit reached. Try again tomorrow.";
    case "request_timeout":
      return "This insight timed out. Please try generating again.";
    case "openai_rate_limited":
      return "The AI service is busy. Please try again in a few minutes.";
    case "openai_timeout":
    case "openai_connection":
      return "Could not reach the AI service. Please try again.";
    case "openai_invalid_response":
      return "The AI returned an invalid response. Please try again.";
    case "task_timeout":
      return "Insight generation took too long. Please try again.";
    case "internal_error":
      return "Something went wrong generating your insight. Please try again.";
    default:
      return "Could not generate insight. Please try again.";
  }
}

function formatGeneratedAt(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Insights() {
  const { user, status: authStatus } = useAuthStore();
  const sessions = useSessionHistoryStore((state) => state.sessions);

  const [range, setRange] = useState<InsightRangeKey>("30d");
  const [latestInsight, setLatestInsight] = useState<ApiInsightRequest | null>(
    null,
  );
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleInsightUpdate = useCallback((row: ApiInsightRequest) => {
    if (row.range_key !== range) {
      return;
    }

    if (row.status === "completed" || row.status === "failed") {
      setLatestInsight(row);
      setActiveRequestId(null);
    }
  }, [range]);

  const { insight: polledInsight, isPolling, pollError } = useInsight(
    activeRequestId,
    { onUpdate: handleInsightUpdate },
  );

  const completedFocusCount = useMemo(
    () => countCompletedFocusSessions(sessions, range),
    [sessions, range],
  );
  const hasEnoughData = completedFocusCount >= MIN_COMPLETED_FOCUS_SESSIONS;
  const isAuthenticated = authStatus === "authenticated" && user !== null;

  const displayInsight = useMemo(() => {
    if (polledInsight && polledInsight.range_key === range) {
      return polledInsight;
    }
    if (latestInsight?.range_key === range) {
      return latestInsight;
    }
    return null;
  }, [polledInsight, latestInsight, range]);

  const isInFlight =
    displayInsight?.status === "queued" ||
    displayInsight?.status === "processing" ||
    isPolling;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoadingLatest(true);
      try {
        const row = await insightsApi.getLatest(range);
        if (!cancelled) {
          setLatestInsight(row);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            setLatestInsight(null);
          } else {
            console.error("[insights] loadLatest failed", error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatest(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, range]);

  const handleRangeChange = (nextRange: InsightRangeKey) => {
    setActiveRequestId(null);
    setActionError(null);
    setRange(nextRange);
  };

  const handleGenerate = async () => {
    setActionError(null);
    setIsGenerating(true);

    try {
      const row = await insightsApi.create({ range });
      setActiveRequestId(row.id);
      if (row.status === "completed") {
        setLatestInsight(row);
        setActiveRequestId(null);
      } else if (row.status === "failed") {
        setLatestInsight(row);
        setActiveRequestId(null);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as InsightApiErrorBody;
        setActionError(mapInsightError(body.error_code ?? null));
      } else {
        setActionError("Could not start insight generation. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const showResult =
    displayInsight?.status === "completed" && displayInsight.result !== null;
  const showFailure =
    displayInsight?.status === "failed" ||
    pollError !== null ||
    actionError !== null;
  const generatedAt = formatGeneratedAt(displayInsight?.completed_at);

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-2 py-3 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] text-foreground sm:px-3">
      <div className="flex min-h-full w-full max-w-[min(100vw-1rem,72rem)] flex-col gap-[clamp(0.625rem,1.6vh,1.125rem)]">
        <section
          className={`${cardClassName} flex flex-col p-[clamp(0.875rem,2.2vh,1.5rem)]`}
        >
          <div className="shrink-0 space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 shrink-0 text-timer-focus" />
              <h2 className="text-[clamp(1.25rem,3vh,1.75rem)] font-semibold text-foreground">
                AI Insights
              </h2>
            </div>
            <p className="text-[clamp(0.85rem,1.8vh,1.05rem)] text-muted-foreground">
              Patterns and suggestions from your focus history.
            </p>
          </div>

          {!isAuthenticated ? (
            <div className="mt-[clamp(1rem,2.5vh,1.75rem)] space-y-4">
              <p className="text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                Sign in to generate AI-powered productivity insights from your
                synced session history.
              </p>
              <AuthControls />
            </div>
          ) : !hasEnoughData ? (
            <div className="mt-[clamp(1rem,2.5vh,1.75rem)]">
              <p className="text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                Complete at least {MIN_COMPLETED_FOCUS_SESSIONS} focus sessions
                in this range to unlock insights. You have {completedFocusCount}{" "}
                so far — keep tracking and check back soon.
              </p>
              <div className="mt-4 flex items-center gap-1">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={range === option.value ? "secondary" : "ghost"}
                    onClick={() => handleRangeChange(option.value)}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-[clamp(0.75rem,1.8vh,1.25rem)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1">
                  {rangeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={range === option.value ? "secondary" : "ghost"}
                      onClick={() => handleRangeChange(option.value)}
                      className="cursor-pointer"
                      disabled={isInFlight || isGenerating}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleGenerate()}
                  disabled={isInFlight || isGenerating || isLoadingLatest}
                  className="cursor-pointer sm:shrink-0"
                >
                  {isInFlight || isGenerating ? "Generating…" : "Generate insight"}
                </Button>
              </div>

              {generatedAt ? (
                <p className="mt-2 text-[clamp(0.75rem,1.4vh,0.9rem)] text-muted-foreground">
                  Last generated {generatedAt}
                </p>
              ) : null}

              {isInFlight ? <InsightSkeleton /> : null}

              {showFailure ? (
                <div
                  className={`${cardClassName} mt-[clamp(0.75rem,1.8vh,1.25rem)] border-destructive/30 bg-destructive/5 p-4`}
                >
                  <p className="text-[clamp(0.9rem,1.8vh,1.05rem)] text-foreground">
                    {pollError ??
                      actionError ??
                      mapInsightError(displayInsight?.error_code)}
                  </p>
                  {displayInsight?.error_detail ? (
                    <p className="mt-1 text-[clamp(0.8rem,1.5vh,0.95rem)] text-muted-foreground">
                      {displayInsight.error_detail}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showResult && displayInsight?.result && !isInFlight ? (
                <InsightResultView result={displayInsight.result} />
              ) : !isInFlight && !showFailure && !showResult ? (
                <div className="mt-[clamp(1rem,2.5vh,1.75rem)] flex items-center justify-center py-8">
                  <p className="text-center text-[clamp(0.95rem,2vh,1.15rem)] text-muted-foreground">
                    {isLoadingLatest
                      ? "Loading your latest insight…"
                      : "No insight for this range yet. Generate one to see patterns and suggestions."}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="mt-[clamp(0.75rem,1.8vh,1.25rem)] space-y-3">
      <div className={`${cardClassName} animate-pulse p-5`}>
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="mt-3 h-3 w-full rounded bg-muted" />
        <div className="mt-2 h-3 w-5/6 rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${cardClassName} animate-pulse p-5`}>
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="mt-3 h-3 w-full rounded bg-muted" />
        </div>
        <div className={`${cardClassName} animate-pulse p-5`}>
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="mt-3 h-3 w-full rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function InsightResultView({ result }: { result: InsightResult }) {
  return (
    <div className="mt-[clamp(0.75rem,1.8vh,1.25rem)] space-y-[clamp(0.5rem,1.4vh,0.875rem)]">
      <div className={`${cardClassName} p-[clamp(0.875rem,2vh,1.25rem)]`}>
        <h3 className="text-[clamp(0.95rem,1.9vh,1.1rem)] font-semibold text-foreground">
          Summary
        </h3>
        <p className="mt-2 text-[clamp(0.9rem,1.8vh,1.05rem)] leading-relaxed text-foreground">
          {result.summary}
        </p>
      </div>

      {result.patterns.length > 0 ? (
        <div className="space-y-[clamp(0.5rem,1.4vh,0.875rem)]">
          <h3 className="text-[clamp(0.95rem,1.9vh,1.1rem)] font-semibold text-foreground">
            Patterns
          </h3>
          <div className="grid gap-[clamp(0.5rem,1.4vh,0.875rem)] sm:grid-cols-2">
            {result.patterns.map((pattern, index) => (
              <div
                key={`${pattern.title}-${index}`}
                className={`${cardClassName} p-[clamp(0.875rem,2vh,1.25rem)]`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[clamp(0.9rem,1.8vh,1.05rem)] font-semibold text-foreground">
                    {pattern.title}
                  </h4>
                  <span className="shrink-0 text-[clamp(0.7rem,1.3vh,0.8rem)] uppercase tracking-wide text-muted-foreground">
                    {pattern.confidence}
                  </span>
                </div>
                <p className="mt-2 text-[clamp(0.85rem,1.6vh,0.98rem)] leading-relaxed text-muted-foreground">
                  {pattern.evidence}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.template_recommendations.length > 0 ? (
        <div className="space-y-[clamp(0.5rem,1.4vh,0.875rem)]">
          <h3 className="text-[clamp(0.95rem,1.9vh,1.1rem)] font-semibold text-foreground">
            Template recommendations
          </h3>
          <div className="grid gap-[clamp(0.5rem,1.4vh,0.875rem)] sm:grid-cols-2">
            {result.template_recommendations.map((rec, index) => (
              <div
                key={`${rec.template_label}-${index}`}
                className={`${cardClassName} p-[clamp(0.875rem,2vh,1.25rem)]`}
              >
                <h4 className="text-[clamp(0.9rem,1.8vh,1.05rem)] font-semibold text-foreground">
                  {rec.template_label}
                </h4>
                <p className="mt-2 text-[clamp(0.85rem,1.6vh,0.98rem)] leading-relaxed text-muted-foreground">
                  {rec.reason}
                </p>
                <p className="mt-2 text-[clamp(0.85rem,1.6vh,0.98rem)] leading-relaxed text-foreground">
                  Try: {rec.suggested_experiment}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.warnings.length > 0 ? (
        <div className={`${cardClassName} p-[clamp(0.875rem,2vh,1.25rem)]`}>
          <h3 className="text-[clamp(0.95rem,1.9vh,1.1rem)] font-semibold text-foreground">
            Warnings
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[clamp(0.85rem,1.6vh,0.98rem)] text-muted-foreground">
            {result.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.next_steps.length > 0 ? (
        <div className={`${cardClassName} p-[clamp(0.875rem,2vh,1.25rem)]`}>
          <h3 className="text-[clamp(0.95rem,1.9vh,1.1rem)] font-semibold text-foreground">
            Next steps
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[clamp(0.85rem,1.6vh,0.98rem)] text-foreground">
            {result.next_steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
