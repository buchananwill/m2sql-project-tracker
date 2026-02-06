import type { SupabaseClient } from '@supabase/supabase-js';
import type { Table, TableSchema } from '@m2sql/model';
import { generateCreateTableSql, isJunctionTableBySchema, parsePostgresType, sqliteTypeToPostgres } from '@m2sql/model';
import type { SupabaseTableSchema, SupabaseColumn, SupabaseForeignKey } from './types.js';

export async function createTable(
  supabase: SupabaseClient,
  table: Table,
  verbose = false
): Promise<void> {
  if (verbose) {
    console.log(`Creating table: ${table.name}`);
  }

  // Use shared DDL generator with PostgreSQL dialect
  const sql = generateCreateTableSql(table, { dialect: 'postgres', verbose });

  const { error } = await supabase.rpc('exec_sql', {
    sql
  });

  if (error) {
    throw new Error(`Failed to create table ${table.name}: ${error.message}`);
  }
}

export async function reloadSchemaCache(
  supabase: SupabaseClient
): Promise<void> {
  // PostgREST listens for NOTIFY signals to reload its schema cache
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'NOTIFY pgrst, \'reload schema\''
  });

  if (error) {
    throw new Error(`Failed to reload schema cache: ${error.message}`);
  }
}

export async function tableExists(
  supabase: SupabaseClient,
  tableName: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('table_exists', {
    table_name_param: tableName
  });

  if (error) {
    throw new Error(`Failed to check table existence: ${error.message}`);
  }

  return data === true;
}

export async function getTableNames(
  supabase: SupabaseClient,
  excludePattern = '(pg_%|information_schema|_mermaid_%)'
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_table_names', {
    exclude_pattern: excludePattern
  });

  if (error) {
    throw new Error(`Failed to get table names: ${error.message}`);
  }

  return data?.map((row: any) => row.table_name) || [];
}

export async function getTableSchema(
  supabase: SupabaseClient,
  tableName: string
): Promise<SupabaseTableSchema> {
  const columns = await getColumns(supabase, tableName);
  const primaryKeys = await getPrimaryKeys(supabase, tableName);
  const foreignKeys = await getForeignKeys(supabase, tableName);

  return {
    tableName,
    columns,
    primaryKeys,
    foreignKeys
  };
}

async function getColumns(
  supabase: SupabaseClient,
  tableName: string
): Promise<SupabaseColumn[]> {
  const { data, error } = await supabase.rpc('get_columns', {
    table_name_param: tableName
  });

  if (error) {
    throw new Error(`Failed to get columns for ${tableName}: ${error.message}`);
  }

  return data?.map((row: any) => ({
    name: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 'YES',
    defaultValue: row.column_default
  })) || [];
}

async function getPrimaryKeys(
  supabase: SupabaseClient,
  tableName: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_primary_keys', {
    table_name_param: tableName
  });

  if (error) {
    throw new Error(`Failed to get primary keys for ${tableName}: ${error.message}`);
  }

  return data?.map((row: any) => row.column_name) || [];
}

async function getForeignKeys(
  supabase: SupabaseClient,
  tableName: string
): Promise<SupabaseForeignKey[]> {
  const { data, error } = await supabase.rpc('get_foreign_keys', {
    table_name_param: tableName
  });

  if (error) {
    console.warn(`Could not get foreign keys for ${tableName}: ${error.message}`);
    return [];
  }

  return data?.map((row: any) => ({
    columnName: row.column_name,
    referencedTable: row.referenced_table,
    referencedColumn: row.referenced_column
  })) || [];
}

export function buildTableSchemaFromSupabase(
  supabaseSchema: SupabaseTableSchema
): TableSchema {
  return {
    name: supabaseSchema.tableName,
    columns: supabaseSchema.columns.map(col => {
      const fk = supabaseSchema.foreignKeys.find(fk => fk.columnName === col.name);
      return {
        name: col.name,
        type: parsePostgresType(col.dataType),
        nullable: col.isNullable,
        primaryKey: supabaseSchema.primaryKeys.includes(col.name),
        unique: false,
        defaultValue: col.defaultValue || null,
        references: fk
          ? {
              table: fk.referencedTable,
              column: fk.referencedColumn
            }
          : undefined
      };
    }),
    primaryKey: supabaseSchema.primaryKeys,
    uniqueConstraints: [],
    checkConstraints: []
  };
}

export function buildRawSqlFromSchema(
  tableName: string,
  schema: SupabaseTableSchema
): string {
  const columnDefs = schema.columns.map(col => {
    const parts = [col.name, col.dataType.toUpperCase()];
    if (!col.isNullable) parts.push('NOT NULL');
    if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
    return parts.join(' ');
  });

  if (schema.primaryKeys.length > 0) {
    columnDefs.push(`PRIMARY KEY (${schema.primaryKeys.join(', ')})`);
  }

  for (const fk of schema.foreignKeys) {
    columnDefs.push(
      `FOREIGN KEY (${fk.columnName}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`
    );
  }

  return `CREATE TABLE ${tableName} (\n  ${columnDefs.join(',\n  ')}\n);`;
}
