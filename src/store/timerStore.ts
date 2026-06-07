import { create } from 'zustand';

export type TimerMode = 'focus' | 'break' | 'longBreak';

interface TimerState {
  // Timer UI state
  isPaused: boolean;
  mode: TimerMode;
  secondsLeft: number;

  // Actions
  setIsPaused: (isPaused: boolean) => void;
  setMode: (mode: TimerMode) => void;
  setSecondsLeft: (seconds: number) => void;
  decrementSeconds: () => void;
  resetTimer: (seconds: number, mode: TimerMode) => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  // Initial state
  isPaused: true,
  mode: 'focus',
  secondsLeft: 0,

  // Actions
  setIsPaused: (isPaused) => set({ isPaused }),
  setMode: (mode) => set({ mode }),
  setSecondsLeft: (seconds) => set({ secondsLeft: seconds }),

  decrementSeconds: () =>
    set((state) => ({
      secondsLeft: Math.max(0, state.secondsLeft - 1),
    })),

  resetTimer: (seconds, mode) =>
    set({
      secondsLeft: seconds,
      mode,
      isPaused: true,
    }),
}));
