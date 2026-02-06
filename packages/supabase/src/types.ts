import type { SupabaseClient } from '@supabase/supabase-js';

export interface PushOptions {
  verbose?: boolean;
  schemaValidation?: boolean;
}

export interface PushResult {
  tablesCreated: number;
  tablesUpdated: number;
  rowsInserted: number;
  rowsUpdated: number;
  warnings: string[];
  errors: string[];
}

export interface PullOptions {
  verbose?: boolean;
  excludePattern?: string;
}

export interface UpsertResult {
  action: 'inserted' | 'updated';
  id: number;
}

export interface SupabaseTableSchema {
  tableName: string;
  columns: SupabaseColumn[];
  primaryKeys: string[];
  foreignKeys: SupabaseForeignKey[];
}

export interface SupabaseColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string;
}

export interface SupabaseForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export type { SupabaseClient };
