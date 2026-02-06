/**
 * Dialect-agnostic DDL generation for CREATE TABLE statements.
 * Handles auto-managed column injection for both SQLite and PostgreSQL.
 */

import type { Table, TableSchema } from './types.js';

export type SqlDialect = 'sqlite' | 'postgres';

export interface DdlOptions {
  dialect?: SqlDialect;
  verbose?: boolean;
}

/**
 * Generates CREATE TABLE SQL from a Table, injecting auto-managed columns if needed.
 * Works for both SQLite and PostgreSQL with minimal dialect differences.
 */
export function generateCreateTableSql(table: Table, options: DdlOptions = {}): string {
  const { dialect = 'sqlite', verbose = false } = options;
  let sql = table.rawSql;

  // Check if this is a junction table
  const isJunctionTable = table.rows.some(
    row => row.columns['_lhs_anchor'] !== undefined && row.columns['_rhs_anchor'] !== undefined
  );

  // Check if auto-managed columns exist
  const hasId = table.schema.columns.some(c => c.name === 'id' || c.primaryKey);
  const hasName = table.schema.columns.some(c => c.name === 'name');
  const hasAnchor = table.schema.columns.some(c => c.name === 'anchor');

  // Junction tables have composite PKs - don't inject auto-managed columns
  // If missing id/name/anchor and table will have rows, inject them
  if (table.rows.length > 0 && !isJunctionTable && (!hasId || !hasName || !hasAnchor)) {
    // Parse the CREATE TABLE to inject columns at the beginning
    const match = sql.match(/^CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*)\);?\s*$/i);
    if (match) {
      const [, tableName, innerContent] = match;

      if (!innerContent) {
        throw new Error(`Cannot parse CREATE TABLE for ${tableName}`);
      }

      const newColumns: string[] = [];

      // Inject auto-managed columns
      if (!hasId) {
        // Both dialects support INTEGER PRIMARY KEY
        // SQLite auto-increments by default, PostgreSQL will use a sequence
        const idColumn = dialect === 'postgres'
          ? 'id SERIAL PRIMARY KEY'
          : 'id INTEGER PRIMARY KEY';
        newColumns.push(idColumn);
      }
      if (!hasName) {
        newColumns.push('name TEXT NOT NULL DEFAULT \'\'');
      }
      if (!hasAnchor) {
        newColumns.push('anchor TEXT NOT NULL DEFAULT \'\'');
      }

      // Combine injected columns with existing columns
      const combinedColumns = [...newColumns, innerContent.trim()].join(',\n  ');
      sql = `CREATE TABLE ${tableName} (\n  ${combinedColumns}\n);`;

      if (verbose) {
        console.log(`  → Injected auto-managed columns (id, name, anchor) for ${tableName}`);
      }
    }
  }

  return sql;
}

/**
 * Enriches a TableSchema by adding auto-managed columns if they're missing.
 * This allows downstream code to work with a complete schema.
 */
export function enrichTableSchema(schema: TableSchema, isJunctionTable = false): TableSchema {
  if (isJunctionTable) {
    return schema; // Junction tables manage their own PKs
  }

  const enrichedColumns = [...schema.columns];
  const enrichedPrimaryKey = [...schema.primaryKey];

  // Add id column if missing
  if (!schema.columns.some(c => c.name === 'id')) {
    enrichedColumns.unshift({
      name: 'id',
      type: 'INTEGER',
      nullable: false,
      primaryKey: true,
      unique: true,
      defaultValue: null
    });
    if (!enrichedPrimaryKey.includes('id')) {
      enrichedPrimaryKey.unshift('id');
    }
  }

  // Add name column if missing
  if (!schema.columns.some(c => c.name === 'name')) {
    enrichedColumns.splice(1, 0, {
      name: 'name',
      type: 'TEXT',
      nullable: false,
      primaryKey: false,
      unique: false,
      defaultValue: ''
    });
  }

  // Add anchor column if missing
  if (!schema.columns.some(c => c.name === 'anchor')) {
    enrichedColumns.splice(2, 0, {
      name: 'anchor',
      type: 'TEXT',
      nullable: false,
      primaryKey: false,
      unique: false,
      defaultValue: ''
    });
  }

  return {
    ...schema,
    columns: enrichedColumns,
    primaryKey: enrichedPrimaryKey
  };
}
