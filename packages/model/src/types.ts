/**
 * Core type definitions for the m2sql project tracker.
 * These types represent the semantic model between markdown and SQLite.
 */

/** SQL column type as declared in schema */
export type SqlColumnType = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';

/** Column definition parsed from SQL schema */
export interface ColumnDefinition {
  name: string;
  type: SqlColumnType;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | number | null;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

/** Table schema parsed from SQL CREATE TABLE */
export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  uniqueConstraints: string[][];
  checkConstraints: string[];
}

/** A value in a row, matching SQL types */
export type RowValue = string | number | null;

/** Column values for a row (column name -> value) */
export type ColumnValues = Record<string, RowValue>;

/** Relationship entry pointing to another row */
export interface RelationshipEntry {
  /** Target row anchor (from markdown link) */
  targetAnchor: string;
  /** Display text from markdown link */
  displayText: string;
  /** Additional properties (e.g., "parent" for part_of) */
  role?: string;
}

/** Relationships grouped by relationship type */
export interface Relationships {
  /** Maps relationship type (e.g., "Part Of", "Depends On") to entries */
  [relationshipType: string]: RelationshipEntry[];
}

/** A row parsed from an H3 heading */
export interface Row {
  /** Row name from heading text */
  name: string;
  /** Auto-generated or explicit anchor */
  anchor: string;
  /** Primary key if present (from `PK: n` syntax) */
  pk?: number;
  /** Column values from #### Columns section */
  columns: ColumnValues;
  /** Relationships from #### Relationships section */
  relationships: Relationships;
  /** Position in source document (for error reporting) */
  sourcePosition?: {
    line: number;
    column: number;
  };
}

/** A table parsed from an H2 heading */
export interface Table {
  /** Table name from heading text */
  name: string;
  /** SQL schema from code block */
  schema: TableSchema;
  /** Raw SQL from the code block */
  rawSql: string;
  /** Rows defined under this table */
  rows: Row[];
}

/** A database parsed from an H1 heading with **Database** marker */
export interface Database {
  /** Database name from heading text */
  name: string;
  /** Anchor/ID for the database */
  anchor: string;
  /** Tables defined within this database */
  tables: Table[];
}

/** Result of parsing a markdown file */
export interface ParseResult {
  /** Databases found in the document */
  databases: Database[];
  /** Parsing errors (non-fatal) */
  warnings: ParseWarning[];
  /** Fatal errors that prevented parsing */
  errors: ParseError[];
}

/** Non-fatal parsing warning */
export interface ParseWarning {
  message: string;
  line?: number;
  column?: number;
}

/** Fatal parsing error */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

/** Validation result for a parsed model */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Validation error */
export interface ValidationError {
  type: 'missing_column' | 'invalid_type' | 'duplicate_anchor' | 'unresolved_reference' | 'cycle_detected' | 'schema_error';
  message: string;
  table?: string;
  row?: string;
  column?: string;
}
