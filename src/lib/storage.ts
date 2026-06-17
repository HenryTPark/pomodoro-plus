import { createJSONStorage, type PersistOptions, type StateStorage } from 'zustand/middleware';

export const STORAGE_KEYS = {
  settings: 'pomodoro-plus:settings',
  session: 'pomodoro-plus:session',
  preferences: 'pomodoro-plus:preferences',
  history: 'pomodoro-plus:history',
} as const;

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function createLocalStorage<T = unknown>() {
  return createJSONStorage<T>(() =>
    typeof window === 'undefined' ? noopStorage : localStorage,
  );
}

export const persistOptions = {
  skipHydration: true,
} satisfies Partial<PersistOptions<unknown>>;
