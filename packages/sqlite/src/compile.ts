/**
 * Compiles a semantic model into a SQLite database.
 * Creates tables from raw SQL, inserts rows, and resolves relationships.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type { Database as DbModel, Table } from '@m2sql/model';

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

    const pkCol = table.schema.primaryKey[0];
    if (!pkCol) continue;

    const hasAnchorCol = table.schema.columns.some(c => c.name === 'anchor');
    if (!hasAnchorCol) continue;

    const rows = allRows(db, `SELECT ${pkCol}, anchor FROM ${table.schema.name}`);
    for (const row of rows) {
      const id = row[pkCol] as number;
      const anchor = row['anchor'] as string;
      if (id !== undefined && anchor) {
        map.set(anchor, id);
      }
    }
  }

  return map;
}

/**
 * Insert rows for a single table.
 */
function insertRows(db: SqlJsDatabase, table: Table): void {
  const pkCol = table.schema.primaryKey[0];
  const schemaColumns = table.schema.columns.map(c => c.name);

  for (const row of table.rows) {
    const colNames: string[] = [];
    const colValues: (string | number | null)[] = [];

    if (row.pk !== undefined && pkCol) {
      colNames.push(pkCol);
      colValues.push(row.pk);
    }

    if (schemaColumns.includes('name')) {
      colNames.push('name');
      colValues.push(row.name);
    }

    colNames.push('anchor');
    colValues.push(row.anchor);

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
    // Phase 1: Create all tables
    for (const table of database.tables) {
      if (table.rawSql) {
        db.run(table.rawSql);
      }
    }

    // Phase 2: Ensure anchor column exists on tables that have rows
    for (const table of database.tables) {
      if (table.rows.length === 0) continue;

      const hasAnchorCol = table.schema.columns.some(c => c.name === 'anchor');
      if (!hasAnchorCol) {
        db.run(`ALTER TABLE ${table.schema.name} ADD COLUMN anchor TEXT UNIQUE`);
      }
    }

    // Phase 3: Insert rows
    for (const table of database.tables) {
      if (table.rows.length === 0) continue;
      insertRows(db, table);
    }

    // Phase 4: Resolve relationships into junction tables
    const anchorToId = buildAnchorToIdMap(database.tables, db);

    for (const table of database.tables) {
      for (const row of table.rows) {
        for (const [relType, entries] of Object.entries(row.relationships)) {
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
  }

  return db;
}

/**
 * Export the database to a Uint8Array (for writing to file).
 */
export function exportDatabase(db: SqlJsDatabase): Uint8Array {
  return db.export();
}
