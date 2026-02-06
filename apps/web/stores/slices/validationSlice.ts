import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export interface ValidationSlice {
  // State
  errors: string[];

  // Actions
  setErrors: (errors: string[]) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
}

export const createValidationSlice: StateCreator<
  AppStore,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  ValidationSlice
> = (set) => ({
  // Initial state
  errors: [],

  // Set all errors
  setErrors: (errors) => {
    set(
      (state) => {
        state.errors = errors;
      },
      false,
      'validation/setErrors'
    );
  },

  // Add a single error
  addError: (error) => {
    set(
      (state) => {
        state.errors.push(error);
      },
      false,
      'validation/addError'
    );
  },

  // Clear all errors
  clearErrors: () => {
    set(
      (state) => {
        state.errors = [];
      },
      false,
      'validation/clearErrors'
    );
  },
});
