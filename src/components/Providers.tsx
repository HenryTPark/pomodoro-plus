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

const stores = [
  useSettingsStore,
  useTimerStore,
  usePreferencesStore,
  useSessionHistoryStore,
] as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const initializeAuth = useAuthStore((state) => state.initialize);

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

  if (!hydrated) {
    return null;
  }

  return (
    <ThemeProvider>
      <Suspense fallback={null}>{children}</Suspense>
    </ThemeProvider>
  );
}
