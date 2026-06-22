import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';
import type { TimerMode } from './timerStore';

const MAX_HISTORY = 500;

export interface CompletedSession {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  durationSeconds: number;
  timestamp: number;
}

export interface SkippedSession {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  durationSeconds: number;
  timestamp: number;
}

export interface ExtendedSession {
  id: string;
  mode: TimerMode;
  templateLabel: string;
  sessionCount: number;
  minutesAdded: number;
  timestamp: number;
}

interface SessionHistoryState {
  completedSessions: CompletedSession[];
  skippedSessions: SkippedSession[];
  extendedSessions: ExtendedSession[];
  logCompleted: (
    data: Omit<CompletedSession, 'id' | 'timestamp'>,
  ) => void;
  logSkipped: (data: Omit<SkippedSession, 'id' | 'timestamp'>) => void;
  logExtended: (
    data: Omit<ExtendedSession, 'id' | 'timestamp'>,
  ) => void;
}

type PersistedSessionHistory = Pick<
  SessionHistoryState,
  'completedSessions' | 'skippedSessions' | 'extendedSessions'
>;

// This is used to identify the session in the history
// may need to change this to a more secure way to create a unique ID
function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function trimHistory<T>(items: T[]) {
  return items.slice(0, MAX_HISTORY);
}

export const useSessionHistoryStore = create<SessionHistoryState>()(
  persist(
    (set) => ({
      completedSessions: [],
      skippedSessions: [],
      extendedSessions: [],

      logCompleted: (data) =>
        set((state) => ({
          completedSessions: trimHistory([
            { ...data, id: createId(), timestamp: Date.now() },
            ...state.completedSessions,
          ]),
        })),

      logSkipped: (data) =>
        set((state) => ({
          skippedSessions: trimHistory([
            { ...data, id: createId(), timestamp: Date.now() },
            ...state.skippedSessions,
          ]),
        })),

      logExtended: (data) =>
        set((state) => ({
          extendedSessions: trimHistory([
            { ...data, id: createId(), timestamp: Date.now() },
            ...state.extendedSessions,
          ]),
        })),
    }),
    {
      name: STORAGE_KEYS.history,
      storage: createLocalStorage<PersistedSessionHistory>(),
      partialize: (state) => ({
        completedSessions: state.completedSessions,
        skippedSessions: state.skippedSessions,
        extendedSessions: state.extendedSessions,
      }),
      ...persistOptions,
    },
  ),
);
