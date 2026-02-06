import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export interface SyncState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface SyncSlice {
  // State
  syncState: SyncState;

  // Actions
  setSyncState: (state: Partial<SyncState>) => void;
  setSyncLoading: (loading: boolean) => void;
  setSyncError: (error: string | null) => void;
  setSyncSuccess: (success: string | null) => void;
  resetSyncState: () => void;
}

const initialSyncState: SyncState = {
  loading: false,
  error: null,
  success: null,
};

export const createSyncSlice: StateCreator<
  AppStore,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  SyncSlice
> = (set) => ({
  // Initial state
  syncState: { ...initialSyncState },

  // Set partial sync state
  setSyncState: (partialState) => {
    set(
      (state) => {
        Object.assign(state.syncState, partialState);
      },
      false,
      'sync/setSyncState'
    );
  },

  // Set loading state
  setSyncLoading: (loading) => {
    set(
      (state) => {
        state.syncState.loading = loading;
      },
      false,
      'sync/setSyncLoading'
    );
  },

  // Set error state
  setSyncError: (error) => {
    set(
      (state) => {
        state.syncState.error = error;
        state.syncState.loading = false;
      },
      false,
      'sync/setSyncError'
    );
  },

  // Set success state
  setSyncSuccess: (success) => {
    set(
      (state) => {
        state.syncState.success = success;
        state.syncState.loading = false;
      },
      false,
      'sync/setSyncSuccess'
    );
  },

  // Reset sync state
  resetSyncState: () => {
    set(
      (state) => {
        state.syncState = { ...initialSyncState };
      },
      false,
      'sync/resetSyncState'
    );
  },
});
