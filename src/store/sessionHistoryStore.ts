import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';
import {
  aggregateLegacyEvents,
  type LegacyCompletedEvent,
  type LegacyExtendedEvent,
  type LegacySkippedEvent,
  type SessionRecord,
} from '@/lib/sessionHistory';

export type {
  SessionRecord,
  TemplateSnapshot,
} from '@/lib/sessionHistory';

const MAX_HISTORY = 500;

interface SessionHistoryState {
  sessions: SessionRecord[];
  logSession: (data: Omit<SessionRecord, 'id' | 'timestamp'>) => void;
}

type PersistedSessionHistory = Pick<SessionHistoryState, 'sessions'>;

interface LegacyPersistedSessionHistory {
  completedSessions?: LegacyCompletedEvent[];
  skippedSessions?: LegacySkippedEvent[];
  extendedSessions?: LegacyExtendedEvent[];
  sessions?: SessionRecord[];
}

// This is used to identify the session in the history
// may need to change this to a more secure way to create a unique ID
function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function trimHistory(items: SessionRecord[]) {
  return items.slice(0, MAX_HISTORY);
}

/** Fill missing fields on older persisted rows (e.g. pre-tag history). */
function normalizeSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.map((session) => ({
    ...session,
    tag: session.tag ?? null,
  }));
}

function migrateSessionHistory(
  persistedState: unknown,
  version: number,
): PersistedSessionHistory {
  const state = (persistedState ?? {}) as LegacyPersistedSessionHistory;

  if (version >= 1 && Array.isArray(state.sessions)) {
    return { sessions: normalizeSessions(state.sessions) };
  }

  return {
    sessions: normalizeSessions(
      aggregateLegacyEvents({
        completed: state.completedSessions ?? [],
        skipped: state.skippedSessions ?? [],
        extended: state.extendedSessions ?? [],
      }),
    ),
  };
}

export const useSessionHistoryStore = create<SessionHistoryState>()(
  persist(
    (set) => ({
      sessions: [],

      logSession: (data) =>
        set((state) => ({
          sessions: trimHistory([
            { ...data, id: createId(), timestamp: Date.now() },
            ...state.sessions,
          ]),
        })),
    }),
    {
      name: STORAGE_KEYS.history,
      storage: createLocalStorage<PersistedSessionHistory>(),
      partialize: (state) => ({
        sessions: state.sessions,
      }),
      version: 1,
      migrate: migrateSessionHistory,
      ...persistOptions,
    },
  ),
);
