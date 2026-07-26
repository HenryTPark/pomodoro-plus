import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';

export type TimerMode = 'focus' | 'break' | 'longBreak';

const DEFAULT_FOCUS_SECONDS = 25 * 60;

interface TimerState {
  isPaused: boolean;
  mode: TimerMode;
  secondsLeft: number;
  count: number;
  elapsedSeconds: number;
  startedAt: number | null;
  pauseCount: number;
  extensionCount: number;
  minutesExtended: number;
  plannedSeconds: number;
  lastActiveAt: number | null;

  setIsPaused: (isPaused: boolean) => void;
  setMode: (mode: TimerMode) => void;
  setSecondsLeft: (seconds: number) => void;
  setCount: (count: number) => void;
  setElapsedSeconds: (seconds: number) => void;
  setStartedAt: (startedAt: number | null) => void;
  setPauseCount: (pauseCount: number) => void;
  setExtensionCount: (extensionCount: number) => void;
  setMinutesExtended: (minutesExtended: number) => void;
  setPlannedSeconds: (plannedSeconds: number) => void;
  setLastActiveAt: (lastActiveAt: number | null) => void;
  decrementSeconds: () => void;
  recordTick: () => void;
  resetSegmentTracking: (plannedSeconds: number) => void;
  resetTimer: (seconds: number, mode?: TimerMode) => void;
}

type PersistedTimerState = Pick<
  TimerState,
  | 'isPaused'
  | 'mode'
  | 'secondsLeft'
  | 'count'
  | 'elapsedSeconds'
  | 'startedAt'
  | 'pauseCount'
  | 'extensionCount'
  | 'minutesExtended'
  | 'plannedSeconds'
  | 'lastActiveAt'
>;

type LegacyPersistedTimerState = Partial<PersistedTimerState>;

function migrateTimerState(
  persistedState: unknown,
  version: number,
): PersistedTimerState {
  const state = (persistedState ?? {}) as LegacyPersistedTimerState;

  if (version >= 1) {
    return {
      isPaused: state.isPaused ?? true,
      mode: state.mode ?? 'focus',
      secondsLeft: state.secondsLeft ?? DEFAULT_FOCUS_SECONDS,
      count: state.count ?? 1,
      elapsedSeconds: state.elapsedSeconds ?? 0,
      startedAt: state.startedAt ?? null,
      pauseCount: state.pauseCount ?? 0,
      extensionCount: state.extensionCount ?? 0,
      minutesExtended: state.minutesExtended ?? 0,
      plannedSeconds: state.plannedSeconds ?? DEFAULT_FOCUS_SECONDS,
      lastActiveAt: state.lastActiveAt ?? null,
    };
  }

  // v0 → v1: approximate planned target; stamp lastActiveAt so an in-progress
  // upgrade does not immediately look abandoned.
  const elapsedSeconds = state.elapsedSeconds ?? 0;
  const secondsLeft = state.secondsLeft ?? DEFAULT_FOCUS_SECONDS;
  const hasActivity = elapsedSeconds > 0;
  const plannedSeconds =
    secondsLeft + elapsedSeconds > 0
      ? secondsLeft + elapsedSeconds
      : DEFAULT_FOCUS_SECONDS;
  const now = Date.now();

  return {
    isPaused: state.isPaused ?? true,
    mode: state.mode ?? 'focus',
    secondsLeft,
    count: state.count ?? 1,
    elapsedSeconds,
    startedAt: hasActivity ? now - elapsedSeconds * 1000 : null,
    pauseCount: 0,
    extensionCount: 0,
    minutesExtended: 0,
    plannedSeconds,
    lastActiveAt: hasActivity ? now : null,
  };
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      isPaused: true,
      mode: 'focus',
      secondsLeft: DEFAULT_FOCUS_SECONDS,
      count: 1,
      elapsedSeconds: 0,
      startedAt: null,
      pauseCount: 0,
      extensionCount: 0,
      minutesExtended: 0,
      plannedSeconds: DEFAULT_FOCUS_SECONDS,
      lastActiveAt: null,

      setIsPaused: (isPaused) => set({ isPaused }),
      setMode: (mode) => set({ mode }),
      setSecondsLeft: (seconds) => set({ secondsLeft: seconds }),
      setCount: (count) => set({ count }),
      setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),
      setStartedAt: (startedAt) => set({ startedAt }),
      setPauseCount: (pauseCount) => set({ pauseCount }),
      setExtensionCount: (extensionCount) => set({ extensionCount }),
      setMinutesExtended: (minutesExtended) => set({ minutesExtended }),
      setPlannedSeconds: (plannedSeconds) => set({ plannedSeconds }),
      setLastActiveAt: (lastActiveAt) => set({ lastActiveAt }),

      decrementSeconds: () =>
        set((state) => ({
          secondsLeft: Math.max(0, state.secondsLeft - 1),
        })),

      recordTick: () =>
        set((state) => ({
          secondsLeft: Math.max(0, state.secondsLeft - 1),
          elapsedSeconds: state.elapsedSeconds + 1,
          lastActiveAt: Date.now(),
        })),

      resetSegmentTracking: (plannedSeconds) =>
        set({
          elapsedSeconds: 0,
          startedAt: null,
          pauseCount: 0,
          extensionCount: 0,
          minutesExtended: 0,
          plannedSeconds,
          lastActiveAt: null,
        }),

      resetTimer: (seconds, mode = 'focus') =>
        set({
          secondsLeft: seconds,
          mode,
          isPaused: true,
          count: 1,
          elapsedSeconds: 0,
          startedAt: null,
          pauseCount: 0,
          extensionCount: 0,
          minutesExtended: 0,
          plannedSeconds: seconds,
          lastActiveAt: null,
        }),
    }),
    {
      name: STORAGE_KEYS.session,
      storage: createLocalStorage<PersistedTimerState>(),
      partialize: (state) => ({
        isPaused: state.isPaused,
        mode: state.mode,
        secondsLeft: state.secondsLeft,
        count: state.count,
        elapsedSeconds: state.elapsedSeconds,
        startedAt: state.startedAt,
        pauseCount: state.pauseCount,
        extensionCount: state.extensionCount,
        minutesExtended: state.minutesExtended,
        plannedSeconds: state.plannedSeconds,
        lastActiveAt: state.lastActiveAt,
      }),
      version: 1,
      migrate: migrateTimerState,
      ...persistOptions,
    },
  ),
);

export function getSecondsForMode(
  mode: TimerMode,
  durations: {
    focusMinutes: number;
    breakMinutes: number;
    longBreakMinutes: number;
  },
) {
  switch (mode) {
    case 'focus':
      return durations.focusMinutes * 60;
    case 'break':
      return durations.breakMinutes * 60;
    case 'longBreak':
      return durations.longBreakMinutes * 60;
  }
}
