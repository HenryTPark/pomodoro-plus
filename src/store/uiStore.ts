import { create } from 'zustand';

export type AppView = 'timer' | 'settings' | 'history' | 'insights';

interface UIState {
  // UI state
  view: AppView;

  // Actions
  setView: (view: AppView) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  view: 'timer',

  // Actions
  setView: (view) => set({ view }),
}));
