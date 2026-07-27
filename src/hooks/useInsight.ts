"use client";

import { useEffect, useRef, useState } from "react";
import { insightsApi, type ApiInsightRequest } from "@/lib/api";

const INITIAL_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 10000;
const BACKOFF_FACTOR = 1.5;
const MAX_POLL_ATTEMPTS = 90;

function isTerminal(status: ApiInsightRequest["status"]): boolean {
  return status === "completed" || status === "failed";
}

export function useInsight(
  requestId: number | null,
  options?: {
    onUpdate?: (row: ApiInsightRequest) => void;
  },
) {
  const [insight, setInsight] = useState<ApiInsightRequest | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const requestIdRef = useRef(requestId);
  const onUpdateRef = useRef(options?.onUpdate);

  useEffect(() => {
    onUpdateRef.current = options?.onUpdate;
  }, [options?.onUpdate]);

  useEffect(() => {
    requestIdRef.current = requestId;

    if (requestId === null) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let interval = INITIAL_POLL_INTERVAL_MS;

    const scheduleNext = () => {
      interval = Math.min(
        Math.round(interval * BACKOFF_FACTOR),
        MAX_POLL_INTERVAL_MS,
      );
      timeoutId = setTimeout(() => void poll(), interval);
    };

    const poll = async () => {
      if (cancelled || requestIdRef.current !== requestId) {
        return;
      }

      attempt += 1;
      if (attempt > MAX_POLL_ATTEMPTS) {
        setPollError("Insight is taking longer than expected. Try again later.");
        return;
      }

      try {
        const row = await insightsApi.get(requestId);
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        setInsight(row);
        setPollError(null);
        onUpdateRef.current?.(row);

        if (!isTerminal(row.status)) {
          scheduleNext();
        }
      } catch {
        if (cancelled) {
          return;
        }
        setPollError("Could not load insight status.");
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [requestId]);

  const activeInsight =
    insight !== null && insight.id === requestId ? insight : null;
  const isPolling =
    requestId !== null &&
    pollError === null &&
    (activeInsight === null || !isTerminal(activeInsight.status));

  return { insight: activeInsight, isPolling, pollError };
}
