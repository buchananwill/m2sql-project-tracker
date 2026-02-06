import type { StateCreator } from 'zustand';
import type { Database } from '@m2sql/model';
import { parseMermaid } from '@m2sql/parser';
import type { AppStore } from '../useAppStore';

export interface DataSlice {
  // State
  database: Database | null;
  mermaidText: string;
  dataSource: 'editor' | 'supabase' | null;

  // Actions
  setDatabase: (db: Database | null, source: 'editor' | 'supabase') => void;
  updateMermaidText: (text: string) => void;
  parseAndSetDatabase: (text: string) => void;
  clearData: () => void;
}

export const createDataSlice: StateCreator<
  AppStore,
  [['zustand/immer', never], ['zustand/devtools', never]],
  [],
  DataSlice
> = (set) => ({
  // Initial state
  database: null,
  mermaidText: '',
  dataSource: null,

  // Set database with source tracking
  setDatabase: (db, source) => {
    set(
      (state) => {
        state.database = db;
        state.dataSource = source;
        // Clear errors when setting valid database
        if (db) {
          state.errors = [];
        }
      },
      false,
      'data/setDatabase'
    );
  },

  // Update mermaid text (for external updates like file load)
  updateMermaidText: (text) => {
    set(
      (state) => {
        state.mermaidText = text;
      },
      false,
      'data/updateMermaidText'
    );
  },

  // Parse mermaid text and update database
  parseAndSetDatabase: (text) => {
    console.log('[parseAndSetDatabase] Called with text length:', text.length);

    set(
      (state) => {
        state.mermaidText = text;

        // Clear state if empty
        if (!text.trim()) {
          state.database = null;
          state.errors = [];
          state.dataSource = null;
          return;
        }

        try {
          const result = parseMermaid(text);
          console.log('[parseAndSetDatabase] Parse result:', {
            databases: result.databases?.length,
            errors: result.errors?.length,
          });

          if (result.errors && result.errors.length > 0) {
            console.log('[parseAndSetDatabase] Parse errors:', result.errors);
            state.errors = result.errors.map((e) => e.message);
            state.database = null;
            state.dataSource = null;
          } else {
            state.errors = [];
            if (result.databases && result.databases.length > 0) {
              const db = result.databases[0]!;
              console.log('[parseAndSetDatabase] Setting database:', {
                name: db.name,
                tables: db.tables.length,
                arrowMappings: db.arrowMappings?.length,
              });
              state.database = db;
              state.dataSource = 'editor';
            } else {
              console.log('[parseAndSetDatabase] No databases found in result');
              state.database = null;
              state.dataSource = null;
            }
          }
        } catch (err) {
          console.error('[parseAndSetDatabase] Parse exception:', err);
          state.errors = [
            err instanceof Error ? err.message : 'Unknown parse error',
          ];
          state.database = null;
          state.dataSource = null;
        }
      },
      false,
      'data/parseAndSetDatabase'
    );
  },

  // Clear all data
  clearData: () => {
    set(
      (state) => {
        state.database = null;
        state.mermaidText = '';
        state.dataSource = null;
        state.errors = [];
      },
      false,
      'data/clearData'
    );
  },
});
