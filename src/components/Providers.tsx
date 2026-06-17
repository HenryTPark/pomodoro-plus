'use client';

import React, { useEffect, useState } from 'react';
import {
  usePreferencesStore,
  useSessionHistoryStore,
  useSettingsStore,
  useTimerStore,
} from '@/store';
import { ThemeProvider } from '@/components/ThemeProvider';

const stores = [
  useSettingsStore,
  useTimerStore,
  usePreferencesStore,
  useSessionHistoryStore,
] as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.all(stores.map((store) => store.persist.rehydrate())).then(
      () => setHydrated(true),
    );
  }, []);

  if (!hydrated) {
    return null;
  }

  return <ThemeProvider>{children}</ThemeProvider>;
}
