import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export interface UIState {
  sidebarCollapsed: boolean;
}

export interface UISlice {
  // State
  uiState: UIState;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const initialUIState: UIState = {
  sidebarCollapsed: false,
};

export const createUISlice: StateCreator<
  AppStore,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  UISlice
> = (set) => ({
  // Initial state
  uiState: { ...initialUIState },

  // Toggle sidebar
  toggleSidebar: () => {
    set(
      (state) => {
        state.uiState.sidebarCollapsed = !state.uiState.sidebarCollapsed;
      },
      false,
      'ui/toggleSidebar'
    );
  },

  // Set sidebar collapsed state
  setSidebarCollapsed: (collapsed) => {
    set(
      (state) => {
        state.uiState.sidebarCollapsed = collapsed;
      },
      false,
      'ui/setSidebarCollapsed'
    );
  },
});
