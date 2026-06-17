'use client';

import { useEffect } from 'react';
import { usePreferencesStore, type ThemePreference } from '@/store';

function resolveTheme(theme: ThemePreference) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolveTheme(theme));
    };

    applyTheme();

    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);

    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  return children;
}
