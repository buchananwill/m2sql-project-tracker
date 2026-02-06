import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { DataSlice } from './slices/dataSlice';
import type { ValidationSlice } from './slices/validationSlice';
import type { SyncSlice } from './slices/syncSlice';
import type { UISlice } from './slices/uiSlice';
import { createDataSlice } from './slices/dataSlice';
import { createValidationSlice } from './slices/validationSlice';
import { createSyncSlice } from './slices/syncSlice';
import { createUISlice } from './slices/uiSlice';

// Combined store type
export type AppStore = DataSlice & ValidationSlice & SyncSlice & UISlice;

// Create the combined store with all slices
export const useAppStore = create<AppStore>()(
  devtools(
    immer((...a) => ({
      ...createDataSlice(...a),
      ...createValidationSlice(...a),
      ...createSyncSlice(...a),
      ...createUISlice(...a),
    })),
    { name: 'm2sql-store' }
  )
);
