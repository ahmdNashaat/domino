import { create } from 'zustand';

interface BackButtonState {
  showExitConfirm: boolean;
  setShowExitConfirm: (show: boolean) => void;
  openExitConfirm: () => void;
  closeExitConfirm: () => void;
}

export const useBackButtonStore = create<BackButtonState>((set) => ({
  showExitConfirm: false,
  setShowExitConfirm: (show) => set({ showExitConfirm: show }),
  openExitConfirm: () => set({ showExitConfirm: true }),
  closeExitConfirm: () => set({ showExitConfirm: false }),
}));
