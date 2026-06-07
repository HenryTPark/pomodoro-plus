import { create } from 'zustand';

interface UIState {
  // UI state
  showSettings: boolean;

  // Actions
  setShowSettings: (show: boolean) => void;
  toggleShowSettings: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  showSettings: false,

  // Actions
  setShowSettings: (show) => set({ showSettings: show }),
  toggleShowSettings: () => set((state) => ({ showSettings: !state.showSettings })),
}));
