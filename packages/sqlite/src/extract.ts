/**
 * Extracts a semantic model from a SQLite database.
 * Reads table schemas, rows, and junction table relationships.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  Database as DbModel,
  Table,
  Row,
  ColumnValues,
  Relationships,
  TableSchema,
  ColumnDefinition,
  SqlColumnType,
  ArrowMapping,
} from '@m2sql/model';
import { readArrowMappings } from './metadata.js';

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

/** SQLite table_info row */
interface TableInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/** SQLite foreign_key_list row */
interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

/** Parse SQLite type string to our normalized type */
function parseSqliteType(typeStr: string): SqlColumnType {
  const upper = (typeStr || 'TEXT').toUpperCase();
  if (upper.includes('INT')) return 'INTEGER';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'REAL';
  if (upper.includes('BLOB')) return 'BLOB';
  return 'TEXT';
}

/** Build a TableSchema from SQLite pragmas */
function extractTableSchema(db: SqlJsDatabase, tableName: string): TableSchema {
  const columns = allRows(db, `PRAGMA table_info(${tableName})`) as unknown as TableInfo[];
  const fks = allRows(db, `PRAGMA foreign_key_list(${tableName})`) as unknown as ForeignKeyInfo[];

  const fkMap = new Map<string, ForeignKeyInfo>();
  for (const fk of fks) {
    fkMap.set(fk.from, fk);
  }

  const colDefs: ColumnDefinition[] = columns.map(col => {
    const fk = fkMap.get(col.name);
    const def: ColumnDefinition = {
      name: col.name,
      type: parseSqliteType(col.type),
      nullable: col.notnull === 0,
      primaryKey: col.pk > 0,
      unique: false,
      defaultValue: col.dflt_value,
    };

    if (fk) {
      def.references = {
        table: fk.table,
        column: fk.to,
        onDelete: fk.on_delete === 'CASCADE' ? 'CASCADE'
          : fk.on_delete === 'SET NULL' ? 'SET NULL'
          : fk.on_delete === 'RESTRICT' ? 'RESTRICT'
          : undefined,
      };
    }

    return def;
  });

  return {
    name: tableName,
    columns: colDefs,
    primaryKey: colDefs.filter(c => c.primaryKey).map(c => c.name),
    uniqueConstraints: [],
    checkConstraints: [],
  };
}

/** Identify junction tables: tables with composite PK of 2+ FK columns */
function isJunctionTable(db: SqlJsDatabase, tableName: string): boolean {
  const columns = allRows(db, `PRAGMA table_info(${tableName})`) as unknown as TableInfo[];
  const fks = allRows(db, `PRAGMA foreign_key_list(${tableName})`) as unknown as ForeignKeyInfo[];

  if (columns.length === 0) return false;

  const fkColumns = new Set(fks.map(fk => fk.from));
  const pkColumns = new Set(columns.filter(c => c.pk > 0).map(c => c.name));

  // A junction table has:
  // 1. At least 2 FK columns
  // 2. Those FK columns form the primary key
  if (fks.length < 2) return false;

  const fkInPk = Array.from(fkColumns).filter(fk => pkColumns.has(fk));
  return fkInPk.length >= 2;
}

/** Get the original CREATE TABLE SQL from sqlite_master */
function getOriginalSql(db: SqlJsDatabase, tableName: string): string {
  const rows = allRows(db, `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
  return (rows[0]?.['sql'] as string) ?? '';
}

/** Build a reverse lookup: id -> anchor */
function buildIdToAnchorMap(
  db: SqlJsDatabase,
  tableName: string,
  pkCol: string,
): Map<number, string> {
  const map = new Map<number, string>();

  // Check if table has anchor column
  const columns = allRows(db, `PRAGMA table_info(${tableName})`) as unknown as TableInfo[];
  if (!columns.some(c => c.name === 'anchor')) return map;

  const rows = allRows(db, `SELECT ${pkCol}, anchor FROM ${tableName}`);
  for (const row of rows) {
    const id = row[pkCol] as number;
    const anchor = row['anchor'] as string;
    if (id !== undefined && anchor) {
      map.set(id, anchor);
    }
  }

  return map;
}

/**
 * Resolve junction table rows into relationship entries for each row.
 */
function resolveJunctionRelationships(
  db: SqlJsDatabase,
  junctionTableName: string,
  allSchemas: Map<string, TableSchema>,
): Map<string, Relationships> {
  const result = new Map<string, Relationships>();

  const fks = allRows(db, `PRAGMA foreign_key_list(${junctionTableName})`) as unknown as ForeignKeyInfo[];
  if (fks.length < 2) return result;

  // Determine relationship type from table name
  let relType = junctionTableName;
  for (const [name] of allSchemas) {
    if (junctionTableName.startsWith(name + '_')) {
      relType = junctionTableName.slice(name.length + 1);
      break;
    }
  }
  relType = relType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const rows = allRows(db, `SELECT * FROM ${junctionTableName}`);

  // Build ID-to-anchor maps for referenced tables
  const idMaps = new Map<string, Map<number, string>>();
  for (const fk of fks) {
    if (!idMaps.has(fk.table)) {
      const refSchema = allSchemas.get(fk.table);
      const refPk = refSchema?.primaryKey[0];
      if (refPk) {
        idMaps.set(fk.table, buildIdToAnchorMap(db, fk.table, refPk));
      }
    }
  }

  const sourceFk = fks[0]!;
  const targetFk = fks[1]!;

  const sourceIdMap = idMaps.get(sourceFk.table);
  const targetIdMap = idMaps.get(targetFk.table);

  if (!sourceIdMap || !targetIdMap) return result;

  for (const row of rows) {
    const sourceId = row[sourceFk.from] as number;
    const targetId = row[targetFk.from] as number;

    const sourceAnchor = sourceIdMap.get(sourceId);
    const targetAnchor = targetIdMap.get(targetId);

    if (!sourceAnchor || !targetAnchor) continue;

    if (!result.has(sourceAnchor)) {
      result.set(sourceAnchor, {});
    }
    const rels = result.get(sourceAnchor)!;
    if (!rels[relType]) {
      rels[relType] = [];
    }

    let role: string | undefined;
    if (targetFk.from.startsWith('parent')) {
      role = 'parent';
    }

    rels[relType]!.push({
      targetAnchor,
      displayText: '',
      role,
    });
  }

  return result;
}

/**
 * Extract a semantic model from a sql.js database instance.
 */
export function extractFromDb(
  db: SqlJsDatabase,
  databaseName: string = 'Extracted Database',
): DbModel {
  const tableRows = allRows(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_mermaid_%' ORDER BY name`
  );

  const schemas = new Map<string, TableSchema>();
  for (const { name } of tableRows) {
    schemas.set(name as string, extractTableSchema(db, name as string));
  }

  const junctionTables: string[] = [];
  const dataTables: string[] = [];

  for (const { name } of tableRows) {
    const tableName = name as string;
    if (isJunctionTable(db, tableName)) {
      junctionTables.push(tableName);
    } else {
      dataTables.push(tableName);
    }
  }

  // Resolve all junction relationships
  const allRelationships = new Map<string, Relationships>();
  for (const jt of junctionTables) {
    const rels = resolveJunctionRelationships(db, jt, schemas);
    for (const [anchor, relMap] of rels) {
      const existing = allRelationships.get(anchor) ?? {};
      for (const [relType, entries] of Object.entries(relMap)) {
        existing[relType] = [...(existing[relType] ?? []), ...entries];
      }
      allRelationships.set(anchor, existing);
    }
  }

  // Extract data tables
  const tables: Table[] = [];

  for (const tableName of dataTables) {
    const schema = schemas.get(tableName)!;
    const rawSql = getOriginalSql(db, tableName);
    const pkCol = schema.primaryKey[0];

    const dbRows = allRows(db, `SELECT * FROM ${tableName}`);

    const rows: Row[] = dbRows.map(dbRow => {
      const anchor = (dbRow['anchor'] as string) ?? '';
      const name = (dbRow['name'] as string) ?? anchor;
      const pk = pkCol ? (dbRow[pkCol] as number) : undefined;

      const columns: ColumnValues = {};
      for (const [colName, value] of Object.entries(dbRow)) {
        if (colName === pkCol || colName === 'name' || colName === 'anchor') continue;
        columns[colName] = value as string | number | null;
      }

      const relationships = allRelationships.get(anchor) ?? {};

      // Fill in display text from target names
      for (const entries of Object.values(relationships)) {
        for (const entry of entries) {
          if (!entry.displayText) {
            for (const dt of dataTables) {
              const targetRows = allRows(db, `SELECT name FROM ${dt} WHERE anchor = ?`, [entry.targetAnchor]);
              if (targetRows.length > 0) {
                entry.displayText = targetRows[0]!['name'] as string;
                break;
              }
            }
          }
        }
      }

      return { name, anchor, pk, columns, relationships };
    });

    tables.push({ name: tableName, schema, rawSql, rows });
  }

  // Include junction tables with their raw data (FK IDs, not anchors)
  for (const jt of junctionTables) {
    const schema = schemas.get(jt)!;
    const rawSql = getOriginalSql(db, jt);

    const dbRows = allRows(db, `SELECT * FROM ${jt}`);

    const rows: Row[] = dbRows.map((dbRow) => {
      const columns: ColumnValues = {};
      // Include ALL columns (FK columns are the PK columns in junction tables)
      for (const [colName, value] of Object.entries(dbRow)) {
        columns[colName] = value as string | number | null;
      }

      return {
        name: '', // No meaningful name for junction rows
        anchor: '', // No anchor needed
        columns,
        relationships: {},
      };
    });

    tables.push({
      name: jt,
      schema,
      rawSql,
      rows,
    });
  }

  // Read arrow mappings from metadata table
  const arrowMappingsData = readArrowMappings(db);
  const arrowMappings: ArrowMapping[] = arrowMappingsData.map(m => ({
    junctionTable: m.junctionTable,
    leftColumn: m.leftColumn,
    arrowToken: m.arrowToken,
    rightColumn: m.rightColumn,
  }));

  return {
    name: databaseName,
    anchor: databaseName.toLowerCase().replace(/\s+/g, '-'),
    tables,
    arrowMappings: arrowMappings.length > 0 ? arrowMappings : undefined,
  };
}

/**
 * Extract a semantic model from a SQLite file on disk.
 */
export async function extractFromSqlite(
  dbData: Uint8Array,
  databaseName: string = 'Extracted Database',
): Promise<DbModel> {
  const SQL = await (await import('sql.js')).default();
  const db = new SQL.Database(dbData);

  try {
    return extractFromDb(db, databaseName);
  } finally {
    db.close();
  }
}
