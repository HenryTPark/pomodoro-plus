import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLocalStorage, persistOptions, STORAGE_KEYS } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';

interface PreferencesState {
  theme: ThemePreference;
  soundEnabled: boolean;
  setTheme: (theme: ThemePreference) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSoundEnabled: () => void;
}

type PersistedPreferences = Pick<PreferencesState, 'theme' | 'soundEnabled'>;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      soundEnabled: true,

      setTheme: (theme) => set({ theme }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      toggleSoundEnabled: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: createLocalStorage<PersistedPreferences>(),
      partialize: (state) => ({
        theme: state.theme,
        soundEnabled: state.soundEnabled,
      }),
      ...persistOptions,
    },
  ),
);
