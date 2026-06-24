'use client';

import React, { Suspense, useEffect, useState } from 'react';
import {
  usePreferencesStore,
  useSessionHistoryStore,
  useSettingsStore,
  useTimerStore,
} from '@/store';
import { useAuthStore } from '@/store/authStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import { bootstrapSync, setupWriteThrough, teardownSync } from '@/lib/sync';

const stores = [
  useSettingsStore,
  useTimerStore,
  usePreferencesStore,
  useSessionHistoryStore,
] as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const authStatus = useAuthStore((state) => state.status);

  useEffect(() => {
    void Promise.all(stores.map((store) => store.persist.rehydrate())).then(
      () => setHydrated(true),
    );
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void initializeAuth();
  }, [hydrated, initializeAuth]);

  useEffect(() => {
    if (!hydrated || authStatus !== 'authenticated') {
      return;
    }

    let cleanupWriteThrough: (() => void) | undefined;

    void bootstrapSync()
      .then((cleanup) => {
        cleanupWriteThrough = cleanup;
      })
      .catch((error) => {
        console.error('[sync] initial sync failed; continuing with local data', error);
        cleanupWriteThrough = setupWriteThrough();
      });

    return () => {
      cleanupWriteThrough?.();
      teardownSync();
    };
  }, [hydrated, authStatus]);

  if (!hydrated) {
    return null;
  }

  return (
    <ThemeProvider>
      <Suspense fallback={null}>{children}</Suspense>
    </ThemeProvider>
  );
}
