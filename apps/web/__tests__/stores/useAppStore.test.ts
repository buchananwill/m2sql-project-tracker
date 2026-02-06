import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAppStore } from '@/stores/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useAppStore.setState({
        mermaidText: '',
        database: null,
        dataSource: null,
        errors: [],
        syncState: {
          loading: false,
          error: null,
          success: null,
        },
        uiState: {
          sidebarCollapsed: false,
        },
      });
    });
  });

  describe('UI Slice', () => {
    it('should have initial sidebar state as not collapsed', () => {
      const state = useAppStore.getState();
      expect(state.uiState.sidebarCollapsed).toBe(false);
    });

    it('should toggle sidebar collapsed state', () => {
      const { toggleSidebar } = useAppStore.getState();

      // Toggle to collapsed
      act(() => {
        toggleSidebar();
      });

      let state = useAppStore.getState();
      expect(state.uiState.sidebarCollapsed).toBe(true);

      // Toggle back to expanded
      act(() => {
        toggleSidebar();
      });

      state = useAppStore.getState();
      expect(state.uiState.sidebarCollapsed).toBe(false);
    });

    it('should set sidebar collapsed state directly', () => {
      const { setSidebarCollapsed } = useAppStore.getState();

      act(() => {
        setSidebarCollapsed(true);
      });

      let state = useAppStore.getState();
      expect(state.uiState.sidebarCollapsed).toBe(true);

      act(() => {
        setSidebarCollapsed(false);
      });

      state = useAppStore.getState();
      expect(state.uiState.sidebarCollapsed).toBe(false);
    });
  });

  describe('Data Slice', () => {
    it('should have initial mermaidText as empty string', () => {
      const state = useAppStore.getState();
      expect(state.mermaidText).toBe('');
    });

    it('should update mermaid text', () => {
      const { updateMermaidText } = useAppStore.getState();

      act(() => {
        updateMermaidText('erDiagram\n  tasks {}');
      });

      const state = useAppStore.getState();
      expect(state.mermaidText).toBe('erDiagram\n  tasks {}');
    });
  });

  describe('Sync Slice', () => {
    it('should have initial sync state as not loading', () => {
      const state = useAppStore.getState();
      expect(state.syncState.loading).toBe(false);
      expect(state.syncState.error).toBeNull();
      expect(state.syncState.success).toBeNull();
    });

    it('should set sync loading state', () => {
      const { setSyncLoading } = useAppStore.getState();

      act(() => {
        setSyncLoading(true);
      });

      const state = useAppStore.getState();
      expect(state.syncState.loading).toBe(true);
    });

    it('should set sync error and clear loading', () => {
      const { setSyncError, setSyncLoading } = useAppStore.getState();

      // Set loading first
      act(() => {
        setSyncLoading(true);
      });

      // Set error
      act(() => {
        setSyncError('Test error');
      });

      const state = useAppStore.getState();
      expect(state.syncState.error).toBe('Test error');
      expect(state.syncState.loading).toBe(false);
    });
  });
});
