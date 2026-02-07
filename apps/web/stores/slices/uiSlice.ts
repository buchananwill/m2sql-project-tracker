import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';
import type { ColorCodingConfig } from '@/lib/types/color-filters';

export interface UIState {
  sidebarCollapsed: boolean;
  colorCodingConfig: ColorCodingConfig;
  colorCodingPanelOpen: boolean;
}

export interface UISlice {
  // State
  uiState: UIState;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setColorCodingConfig: (config: ColorCodingConfig) => void;
  setColorCodingPanelOpen: (open: boolean) => void;
}

const initialUIState: UIState = {
  sidebarCollapsed: false,
  colorCodingConfig: {
    background: [],
    border: [],
    text: [],
  },
  colorCodingPanelOpen: false,
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

  // Set color coding configuration
  setColorCodingConfig: (config) => {
    set(
      (state) => {
        state.uiState.colorCodingConfig = config;
      },
      false,
      'ui/setColorCodingConfig'
    );
  },

  // Set color coding panel open state
  setColorCodingPanelOpen: (open) => {
    set(
      (state) => {
        state.uiState.colorCodingPanelOpen = open;
      },
      false,
      'ui/setColorCodingPanelOpen'
    );
  },
});
