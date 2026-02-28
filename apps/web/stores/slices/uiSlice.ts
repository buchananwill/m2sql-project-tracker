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
  collapsedNodeIds: string[];              // node IDs whose children are hidden
  collapseRelationship: string;            // junction table name for parent-child ('' = auto-detect *--)
}

export interface HoveredNodeInfo {
  nodeId: string;
  label: string;
  screenX: number;
  screenY: number;
}

export interface UIState {
  sidebarCollapsed: boolean;
  colorCodingConfig: ColorCodingConfig;
  colorCodingPanelOpen: boolean;
  appliedGraphConfig: GraphRendererConfig;
  pendingGraphConfig: GraphRendererConfig;
  autoApplyLayout: boolean;
  graphConfigPanelOpen: boolean;
  hoveredNode: HoveredNodeInfo | null;
}

export interface UISlice {
  // State
  uiState: UIState;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setColorCodingConfig: (config: ColorCodingConfig) => void;
  setColorCodingPanelOpen: (open: boolean) => void;
  updatePendingGraphConfig: (patch: Partial<GraphRendererConfig>) => void;
  applyGraphConfig: () => void;
  discardPendingGraphConfig: () => void;
  setAutoApplyLayout: (enabled: boolean) => void;
  setGraphConfigPanelOpen: (open: boolean) => void;
  setHoveredNode: (info: HoveredNodeInfo | null) => void;
}

const defaultGraphConfig: GraphRendererConfig = {
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
  collapsedNodeIds: [],
  collapseRelationship: '',
};

const initialUIState: UIState = {
  sidebarCollapsed: false,
  colorCodingConfig: {
    background: [],
    border: [],
    text: [],
  },
  colorCodingPanelOpen: false,
  appliedGraphConfig: { ...defaultGraphConfig },
  pendingGraphConfig: { ...defaultGraphConfig },
  autoApplyLayout: false,
  graphConfigPanelOpen: false,
  hoveredNode: null,
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

  // Merge a partial update into the pending graph config.
  // When autoApplyLayout is on, immediately commit to applied too.
  updatePendingGraphConfig: (patch) => {
    set(
      (state) => {
        Object.assign(state.uiState.pendingGraphConfig, patch);
        if (state.uiState.autoApplyLayout) {
          state.uiState.appliedGraphConfig = { ...state.uiState.pendingGraphConfig };
        }
      },
      false,
      'ui/updatePendingGraphConfig'
    );
  },

  // Commit pending config → applied config (triggers re-layout)
  applyGraphConfig: () => {
    set(
      (state) => {
        state.uiState.appliedGraphConfig = { ...state.uiState.pendingGraphConfig };
      },
      false,
      'ui/applyGraphConfig'
    );
  },

  // Discard pending changes (reset to applied)
  discardPendingGraphConfig: () => {
    set(
      (state) => {
        state.uiState.pendingGraphConfig = { ...state.uiState.appliedGraphConfig };
      },
      false,
      'ui/discardPendingGraphConfig'
    );
  },

  // Toggle auto-apply; flush pending changes when turning on
  setAutoApplyLayout: (enabled) => {
    set(
      (state) => {
        state.uiState.autoApplyLayout = enabled;
        if (enabled) {
          state.uiState.appliedGraphConfig = { ...state.uiState.pendingGraphConfig };
        }
      },
      false,
      'ui/setAutoApplyLayout'
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

  // Set hovered node for popover
  setHoveredNode: (info) => {
    set(
      (state) => {
        state.uiState.hoveredNode = info;
      },
      false,
      'ui/setHoveredNode'
    );
  },
});
