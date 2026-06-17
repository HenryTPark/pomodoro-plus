import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';

export type TimerMode = 'focus' | 'break' | 'longBreak';

interface TimerState {
  isPaused: boolean;
  mode: TimerMode;
  secondsLeft: number;
  count: number;

  setIsPaused: (isPaused: boolean) => void;
  setMode: (mode: TimerMode) => void;
  setSecondsLeft: (seconds: number) => void;
  setCount: (count: number) => void;
  decrementSeconds: () => void;
  resetTimer: (seconds: number, mode?: TimerMode) => void;
}

type PersistedTimerState = Pick<
  TimerState,
  'isPaused' | 'mode' | 'secondsLeft' | 'count'
>;

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      isPaused: true,
      mode: 'focus',
      secondsLeft: 25 * 60,
      count: 1,

      setIsPaused: (isPaused) => set({ isPaused }),
      setMode: (mode) => set({ mode }),
      setSecondsLeft: (seconds) => set({ secondsLeft: seconds }),
      setCount: (count) => set({ count }),

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
