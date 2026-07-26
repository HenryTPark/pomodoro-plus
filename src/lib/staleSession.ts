import { useSessionHistoryStore } from '@/store/sessionHistoryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';

/** Idle floor: classic 25m sessions wait at least 30 minutes. */
export const STALE_FLOOR_SECONDS = 30 * 60;
/** Safety ceiling on idle time before we give up (not a focus length). */
export const STALE_CEILING_SECONDS = 12 * 3600;

/**
 * STALE_THRESHOLD_MS = min(12h, max(30min, plannedSeconds)) * 1000
 * Classic 25m → 30m; Deep Work 52m → 52m; Ultradian 90m → 90m.
 */
export function getStaleThresholdMs(plannedSeconds: number): number {
  const planned = Math.max(0, plannedSeconds);
  return (
    Math.min(STALE_CEILING_SECONDS, Math.max(STALE_FLOOR_SECONDS, planned)) *
    1000
  );
}

export function isSessionStale(options: {
  lastActiveAt: number | null;
  plannedSeconds: number;
  now?: number;
}): boolean {
  const { lastActiveAt, plannedSeconds, now = Date.now() } = options;
  if (lastActiveAt == null) {
    return false;
  }
  return now - lastActiveAt > getStaleThresholdMs(plannedSeconds);
}

/**
 * Mid-session pause time only — uses lastActiveAt so the abandon gap
 * (walk-away / tab-closed idle) does not inflate pausedSeconds.
 */
export function computeAbandonedPausedSeconds(options: {
  startedAt: number | null;
  lastActiveAt: number | null;
  durationSeconds: number;
}): number {
  const { startedAt, lastActiveAt, durationSeconds } = options;
  if (startedAt == null || lastActiveAt == null) {
    return 0;
  }
  return Math.max(
    0,
    Math.round((lastActiveAt - startedAt) / 1000) - durationSeconds,
  );
}

/**
 * After rehydrate: if the persisted segment is stale, log it as stopped
 * and reset the timer to a fresh paused focus segment.
 * Returns true when a session was finalized.
 */
export function finalizeStaleSessionIfNeeded(now = Date.now()): boolean {
  const timer = useTimerStore.getState();
  const {
    elapsedSeconds,
    extensionCount,
    lastActiveAt,
    plannedSeconds,
    startedAt,
    pauseCount,
    minutesExtended,
    mode,
    count,
  } = timer;

  if (elapsedSeconds === 0 && extensionCount === 0) {
    return false;
  }

  if (!isSessionStale({ lastActiveAt, plannedSeconds, now })) {
    return false;
  }

  const settings = useSettingsStore.getState();
  useSessionHistoryStore.getState().logSession({
    mode,
    templateLabel: settings.templateLabel,
    tag: settings.activeTag,
    sessionCount: count,
    outcome: 'stopped',
    durationSeconds: elapsedSeconds,
    plannedSeconds,
    extensionCount,
    minutesExtended,
    pauseCount,
    pausedSeconds: computeAbandonedPausedSeconds({
      startedAt,
      lastActiveAt,
      durationSeconds: elapsedSeconds,
    }),
    startedAt,
    templateSnapshot: {
      focusMinutes: settings.focusMinutes,
      breakMinutes: settings.breakMinutes,
      longBreakMinutes: settings.longBreakMinutes,
      cycle: settings.cycle,
    },
  });

  timer.resetTimer(settings.focusMinutes * 60, 'focus');
  return true;
}
