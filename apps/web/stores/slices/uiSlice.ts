import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';
import type { ColorCodingConfig } from '@/lib/types/color-filters';

export type RankDir = 'TB' | 'LR' | 'BT' | 'RL';

export interface DataDrivenSizingConfig {
  enabled: boolean;
  column: string;
  axis: 'width' | 'height';
  scaleFactor: number;
  minSize: number;
}

export interface GraphRendererConfig {
  fixWidth: boolean;
  fixHeight: boolean;
  hiddenColumns: Record<string, string[]>; // tableName → hidden column names
  excludedEdgeSources: string[];           // junction table names to exclude from layout
  rankdir: RankDir;
  nodesep: number;
  ranksep: number;
  dataDrivenSizing: DataDrivenSizingConfig;
}

export interface UIState {
  sidebarCollapsed: boolean;
  colorCodingConfig: ColorCodingConfig;
  colorCodingPanelOpen: boolean;
  graphConfig: GraphRendererConfig;
  graphConfigPanelOpen: boolean;
}

export interface UISlice {
  // State
  uiState: UIState;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setColorCodingConfig: (config: ColorCodingConfig) => void;
  setColorCodingPanelOpen: (open: boolean) => void;
  setGraphConfig: (config: GraphRendererConfig) => void;
  setGraphConfigPanelOpen: (open: boolean) => void;
}

const initialUIState: UIState = {
  sidebarCollapsed: false,
  colorCodingConfig: {
    background: [],
    border: [],
    text: [],
  },
  colorCodingPanelOpen: false,
  graphConfig: {
    fixWidth: false,
    fixHeight: false,
    hiddenColumns: {},
    excludedEdgeSources: [],
    rankdir: 'TB',
    nodesep: 100,
    ranksep: 100,
    dataDrivenSizing: {
      enabled: false,
      column: '',
      axis: 'width',
      scaleFactor: 20,
      minSize: 80,
    },
  },
  graphConfigPanelOpen: false,
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

  // Set graph renderer configuration
  setGraphConfig: (config) => {
    set(
      (state) => {
        state.uiState.graphConfig = config;
      },
      false,
      'ui/setGraphConfig'
    );
  },

  // Set graph config panel open state
  setGraphConfigPanelOpen: (open) => {
    set(
      (state) => {
        state.uiState.graphConfigPanelOpen = open;
      },
      false,
      'ui/setGraphConfigPanelOpen'
    );
  },
});
