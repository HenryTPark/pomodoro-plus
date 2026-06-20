import { create } from 'zustand';

export type AppView = 'timer' | 'settings' | 'history';

interface UIState {
  // UI state
  view: AppView;

  // Actions
  setView: (view: AppView) => void;
  toggleView: (view: Exclude<AppView, 'timer'>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  view: 'timer',

  // Actions
  setView: (view) => set({ view }),
  toggleView: (view) =>
    set((state) => ({ view: state.view === view ? 'timer' : view })),
}));
