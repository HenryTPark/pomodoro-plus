import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';

export type TimerMode = 'focus' | 'break' | 'longBreak';

interface TimerState {
  isPaused: boolean;
  mode: TimerMode;
  secondsLeft: number;
  count: number;
  elapsedSeconds: number;

  setIsPaused: (isPaused: boolean) => void;
  setMode: (mode: TimerMode) => void;
  setSecondsLeft: (seconds: number) => void;
  setCount: (count: number) => void;
  setElapsedSeconds: (seconds: number) => void;
  decrementSeconds: () => void;
  resetTimer: (seconds: number, mode?: TimerMode) => void;
}

type PersistedTimerState = Pick<
  TimerState,
  'isPaused' | 'mode' | 'secondsLeft' | 'count' | 'elapsedSeconds'
>;

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      isPaused: true,
      mode: 'focus',
      secondsLeft: 25 * 60,
      count: 1,
      elapsedSeconds: 0,

      setIsPaused: (isPaused) => set({ isPaused }),
      setMode: (mode) => set({ mode }),
      setSecondsLeft: (seconds) => set({ secondsLeft: seconds }),
      setCount: (count) => set({ count }),
      setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

      decrementSeconds: () =>
        set((state) => ({
          secondsLeft: Math.max(0, state.secondsLeft - 1),
        })),

      resetTimer: (seconds, mode = 'focus') =>
        set({
          secondsLeft: seconds,
          mode,
          isPaused: true,
          count: 1,
          elapsedSeconds: 0,
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
      }),
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
