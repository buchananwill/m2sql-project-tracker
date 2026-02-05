/**
 * Compiles a semantic model into a SQLite database.
 * Creates tables from raw SQL, inserts rows, and resolves relationships.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type {Database as DbModel, RowValue, Table} from '@m2sql/model';

/** Junction table configuration inferred from schema */
interface JunctionTableConfig {
  tableName: string;
  sourceColumn: string;
  targetColumn: string;
}

/** Helper: run a query and return all rows as objects */
function allRows(db: SqlJsDatabase, sql: string, params?: unknown[]): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

/**
 * Infer junction table configuration from relationship type and available tables.
 */
function inferJunctionConfig(
  relationshipType: string,
  sourceTable: Table,
  allTables: Table[],
): JunctionTableConfig | null {
  const relLower = relationshipType.toLowerCase().replace(/\s+/g, '_');
  const sourceTableLower = sourceTable.schema.name.toLowerCase();

  const candidates = [
    `${sourceTableLower}_${relLower}`,
    relLower,
  ];

  for (const candidate of candidates) {
    const junctionTable = allTables.find(
      t => t.schema.name.toLowerCase() === candidate
    );

    if (junctionTable) {
      const columns = junctionTable.schema.columns;
      const fkColumns = columns.filter(
        c => c.references?.table === sourceTable.schema.name
      );

      if (fkColumns.length >= 2) {
        return {
          tableName: junctionTable.schema.name,
          sourceColumn: fkColumns[0]!.name,
          targetColumn: fkColumns[1]!.name,
        };
      }

      if (fkColumns.length === 1) {
        const otherFk = columns.find(c => c.references && c !== fkColumns[0]);
        if (otherFk) {
          return {
            tableName: junctionTable.schema.name,
            sourceColumn: fkColumns[0]!.name,
            targetColumn: otherFk.name,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Build a lookup map from anchor to assigned row ID.
 */
function buildAnchorToIdMap(
  tables: Table[],
  db: SqlJsDatabase,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const table of tables) {
    if (table.rows.length === 0) continue;

    const pkCol = table.schema.primaryKey[0] || 'id';

    // Try to query anchor column - it may have been auto-injected even if not in schema
    try {
      const rows = allRows(db, `SELECT ${pkCol}, anchor FROM ${table.schema.name}`);
      for (const row of rows) {
        const id = row[pkCol] as number;
        const anchor = row['anchor'] as string;
        if (id !== undefined && anchor) {
          map.set(anchor, id);
        }
      }
    } catch {
      // Table doesn't have anchor column - skip it
      continue;
    }
  }

  return map;
}

/**
 * Insert rows for a single table.
 */
function insertRows(db: SqlJsDatabase, table: Table): void {
  const pkCol = table.schema.primaryKey[0] || 'id';
  const schemaColumns = table.schema.columns.map(c => c.name);

  for (const row of table.rows) {
    const colNames: string[] = [];
    const colValues: (string | number | null)[] = [];

    // Always try to insert id if provided
    if (row.pk !== undefined) {
      colNames.push(pkCol);
      colValues.push(row.pk);
    }

    // Always insert name (auto-managed column)
    colNames.push('name');
    colValues.push(row.name);

    // Always insert anchor (auto-managed column)
    colNames.push('anchor');
    colValues.push(row.anchor);

    // Insert other columns from row.columns
    for (const [colName, value] of Object.entries(row.columns)) {
      if (colNames.includes(colName)) continue;
      colNames.push(colName);
      colValues.push(value);
    }

    const placeholders = colNames.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table.schema.name} (${colNames.join(', ')}) VALUES (${placeholders})`;

    try {
      db.run(sql, colValues as (string | number | null | Uint8Array)[]);
    } catch (e) {
      const err = e as Error;
      throw new Error(
        `Failed to insert row "${row.name}" into ${table.schema.name}: ${err.message}`
      );
    }
  }
}

/**
 * Initialize sql.js and return the SQL constructor.
 */
let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

/**
 * Compile a semantic model into a SQLite database.
 *
 * @param databases - Parsed database models
 * @returns The sql.js database instance (in-memory)
 */
export async function compileToSqlite(
  databases: DbModel[],
): Promise<SqlJsDatabase> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();

  db.run('PRAGMA foreign_keys = ON');

  for (const database of databases) {
    // Phase 1: Create all tables (inject auto-managed columns if needed)
    for (const table of database.tables) {
      if (table.rawSql) {
        let sql = table.rawSql;

        // Check if this is a junction table (has _lhs_anchor and _rhs_anchor columns)
        const isJunctionTable = table.rows.some(
          r => r.columns['_lhs_anchor'] !== undefined && r.columns['_rhs_anchor'] !== undefined
        );

        // Check if auto-managed columns need to be injected
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
              throw new Error(`Failed to parse CREATE TABLE statement for ${tableName}`);
            }

            const newColumns: string[] = [];

            if (!hasId) {
              newColumns.push('id INTEGER PRIMARY KEY');
            }
            if (!hasName) {
              newColumns.push('name TEXT NOT NULL DEFAULT \'\'');
            }
            if (!hasAnchor) {
              newColumns.push('anchor TEXT UNIQUE');
            }

            if (newColumns.length > 0) {
              sql = `CREATE TABLE ${tableName} (\n  ${newColumns.join(',\n  ')},\n  ${innerContent.trim()}\n)`;
            }
          }
        }

        db.run(sql);
      }
    }

    // Phase 2: No longer needed - auto-managed columns are injected in Phase 1

    // Phase 3: Insert rows (data tables only - skip junction tables for now)
    const junctionTables = new Set<string>();
    for (const table of database.tables) {
      // Check if this is a junction table (has _lhs_anchor and _rhs_anchor columns)
      const isJunctionTable = table.rows.some(
        r => r.columns["_lhs_anchor"] !== undefined && r.columns["_rhs_anchor"] !== undefined
      );

      if (isJunctionTable) {
        junctionTables.add(table.name);
        continue;
      }

      if (table.rows.length === 0) continue;
      insertRows(db, table);
    }

    // Phase 4: Build anchor to ID map from data tables
    const anchorToId = buildAnchorToIdMap(database.tables, db);

    // Phase 5a: Handle markdown-style nested relationships (backward compatibility)
    for (const table of database.tables) {
      if (junctionTables.has(table.name)) continue; // Skip junction tables

      for (const row of table.rows) {
        for (const [relType, entries] of Object.entries(row.relationships)) {
          if (entries.length === 0) continue;

          const config = inferJunctionConfig(relType, table, database.tables);
          if (!config) continue;

          const sourceId = anchorToId.get(row.anchor);
          if (sourceId === undefined) continue;

          for (const entry of entries) {
            const targetId = anchorToId.get(entry.targetAnchor);
            if (targetId === undefined) continue;

            const insertSql = `INSERT OR IGNORE INTO ${config.tableName} (${config.sourceColumn}, ${config.targetColumn}) VALUES (?, ?)`;
            try {
              db.run(insertSql, [sourceId, targetId]);
            } catch {
              // Skip constraint violations silently
            }
          }
        }
      }
    }

    // Phase 5b: Insert mermaid-style junction table rows with resolved FK IDs
    for (const table of database.tables) {
      if (!junctionTables.has(table.name)) continue;

      // Find the arrow mapping for this junction table
      // (This requires passing arrow mappings to compiler - for now use inference)

      for (const row of table.rows) {
        const lhsAnchor = row.columns["_lhs_anchor"] as string;
        const rhsAnchor = row.columns["_rhs_anchor"] as string;

        if (!lhsAnchor || !rhsAnchor) continue;

        const lhsId = anchorToId.get(lhsAnchor);
        const rhsId = anchorToId.get(rhsAnchor);

        if (lhsId === undefined || rhsId === undefined) {
          console.warn(`Cannot resolve anchors for junction row: ${lhsAnchor} -> ${rhsAnchor}`);
          continue;
        }

        // Get FK columns from schema
        const fkColumns = table.schema.columns.filter(c => c.references);
        if (fkColumns.length < 2) {
          console.warn(`Junction table ${table.name} doesn't have 2 FK columns`);
          continue;
        }

        const leftCol = fkColumns[0]!;
        const rightCol = fkColumns[1]!;

        const colNames = [leftCol.name, rightCol.name];
        const colValues: RowValue[] = [lhsId, rhsId];

        // Add label if present
        if (row.columns["label"] !== undefined) {
          colNames.push('label');
          colValues.push(row.columns["label"]);
        }

        const placeholders = colNames.map(() => '?').join(', ');
        const insertSql = `INSERT OR IGNORE INTO ${table.name} (${colNames.join(', ')}) VALUES (${placeholders})`;

        try {
          db.run(insertSql, colValues as (string | number | null | Uint8Array)[]);
        } catch (e) {
          const err = e as Error;
          console.warn(`Failed to insert junction row: ${err.message}`);
        }
      }
    }
  }

  return db;
}

/**
 * Export the database to a Uint8Array (for writing to file).
 */
export function exportDatabase(db: SqlJsDatabase): Uint8Array {
  return db.export();
}
