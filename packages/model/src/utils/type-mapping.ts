/**
 * Type mapping utilities for converting between database types.
 * Supports SQLite and PostgreSQL type mappings to normalized SQL types.
 */

import type { SqlColumnType } from '../types.js';

/**
 * Parse SQLite type string to normalized SQL type.
 * SQLite uses dynamic typing but conventionally uses type keywords.
 */
export function parseSqliteType(typeStr: string): SqlColumnType {
  const upper = (typeStr || 'TEXT').toUpperCase();
  if (upper.includes('INT')) return 'INTEGER';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'REAL';
  if (upper.includes('BLOB')) return 'BLOB';
  return 'TEXT';
}

/**
 * Parse PostgreSQL type to normalized SQL type.
 * Maps common PostgreSQL types to SQLite-compatible types.
 */
export function parsePostgresType(pgType: string): SqlColumnType {
  const typeMap: Record<string, SqlColumnType> = {
    'integer': 'INTEGER',
    'bigint': 'INTEGER',
    'smallint': 'INTEGER',
    'text': 'TEXT',
    'character varying': 'TEXT',
    'varchar': 'TEXT',
    'char': 'TEXT',
    'boolean': 'INTEGER',
    'timestamp with time zone': 'TEXT',
    'timestamp without time zone': 'TEXT',
    'timestamptz': 'TEXT',
    'date': 'TEXT',
    'time': 'TEXT',
    'real': 'REAL',
    'double precision': 'REAL',
    'numeric': 'REAL',
    'decimal': 'REAL',
    'bytea': 'BLOB',
  };

  return typeMap[pgType.toLowerCase()] || 'TEXT';
}

/**
 * Convert SQLite type to PostgreSQL type.
 * Maps normalized SQL types to PostgreSQL equivalents.
 */
export function sqliteTypeToPostgres(sqliteType: SqlColumnType): string {
  const typeMap: Record<SqlColumnType, string> = {
    'INTEGER': 'integer',
    'TEXT': 'text',
    'REAL': 'double precision',
    'BLOB': 'bytea',
  };

  return typeMap[sqliteType] || 'text';
}
