import type { TimerMode } from '@/store/timerStore';

export interface TemplateSnapshot {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cycle: number;
}

export interface SessionRecord {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  outcome: 'completed' | 'skipped' | 'stopped';
  durationSeconds: number;
  plannedSeconds: number;
  extensionCount: number;
  minutesExtended: number;
  pauseCount: number;
  pausedSeconds: number;
  startedAt: number | null;
  timestamp: number;
  templateSnapshot: TemplateSnapshot | null;
}

export interface LegacyCompletedEvent {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  durationSeconds: number;
  timestamp: number;
}

export type LegacySkippedEvent = LegacyCompletedEvent;

export interface LegacyExtendedEvent {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  minutesAdded: number;
  timestamp: number;
}

type LegacyTerminalEvent = (LegacyCompletedEvent | LegacySkippedEvent) & {
  outcome: 'completed' | 'skipped';
};

type LegacyTimelineEvent =
  | (LegacyTerminalEvent & { kind: 'terminal' })
  | (LegacyExtendedEvent & { kind: 'extended' });

function bucketKey(
  mode: TimerMode,
  templateLabel: string,
  sessionCount: number,
): string {
  return `${mode}\0${templateLabel}\0${sessionCount}`;
}

/**
 * Fold legacy completed / skipped / extended event streams into unified
 * SessionRecords. Extension stats are accrued onto the next matching
 * completed or skipped event with the same mode, template, and session count.
 * Legacy rows lack pause / planned / template-config data — those fields are
 * filled with unknowns (0 / null) and must not be treated as real zeros.
 */
export function aggregateLegacyEvents(input: {
  completed: LegacyCompletedEvent[];
  skipped: LegacySkippedEvent[];
  extended: LegacyExtendedEvent[];
}): SessionRecord[] {
  const timeline: LegacyTimelineEvent[] = [
    ...input.completed.map(
      (event): LegacyTimelineEvent => ({
        ...event,
        kind: 'terminal',
        outcome: 'completed',
      }),
    ),
    ...input.skipped.map(
      (event): LegacyTimelineEvent => ({
        ...event,
        kind: 'terminal',
        outcome: 'skipped',
      }),
    ),
    ...input.extended.map(
      (event): LegacyTimelineEvent => ({
        ...event,
        kind: 'extended',
      }),
    ),
  ].sort((left, right) => left.timestamp - right.timestamp);

  const pending = new Map<
    string,
    { extensionCount: number; minutesExtended: number }
  >();
  const sessions: SessionRecord[] = [];

  for (const event of timeline) {
    const key = bucketKey(event.mode, event.templateLabel, event.sessionCount);

    if (event.kind === 'extended') {
      const bucket = pending.get(key) ?? {
        extensionCount: 0,
        minutesExtended: 0,
      };
      bucket.extensionCount += 1;
      bucket.minutesExtended += event.minutesAdded;
      pending.set(key, bucket);
      continue;
    }

    const bucket = pending.get(key);
    pending.delete(key);

    sessions.push({
      id: event.id,
      mode: event.mode,
      templateLabel: event.templateLabel,
      sessionCount: event.sessionCount,
      outcome: event.outcome,
      durationSeconds: event.durationSeconds,
      plannedSeconds: 0,
      extensionCount: bucket?.extensionCount ?? 0,
      minutesExtended: bucket?.minutesExtended ?? 0,
      pauseCount: 0,
      pausedSeconds: 0,
      startedAt: null,
      timestamp: event.timestamp,
      templateSnapshot: null,
    });
  }

  return sessions.sort((left, right) => right.timestamp - left.timestamp);
}
