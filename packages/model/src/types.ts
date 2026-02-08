/**
 * Core type definitions for the m2sql project tracker.
 * These types represent the intermediate model between Mermaid classDiagram
 * source files (.mmd) and SQL databases (SQLite / Supabase).
 *
 * See notes/MERMAID_RULESHEET.md for the full specification of the
 * Mermaid classDiagram format that these types model.
 */

/** SQL column type as declared in schema */
export type SqlColumnType = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';

/** Column definition parsed from a CREATE TABLE statement in the Mermaid header */
export interface ColumnDefinition {
  name: string;
  type: SqlColumnType;
  nullable: boolean;
  primaryKey: boolean;
  /** Reserved for future use (currently always false) */
  unique: boolean;
  defaultValue: string | number | null;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

/** Table schema parsed from a commented CREATE TABLE in the Mermaid header */
export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  /** Reserved for future use (currently unpopulated) */
  uniqueConstraints: string[][];
  /** Reserved for future use (currently unpopulated) */
  checkConstraints: string[];
}

/** A value in a row, matching SQL types */
export type RowValue = string | number | null;

/** Column values for a row (column name -> value) */
export type ColumnValues = Record<string, RowValue>;

/** Relationship entry pointing to another row */
export interface RelationshipEntry {
  /** Target row anchor */
  targetAnchor: string;
  /** Display text (e.g., arrow label) */
  displayText: string;
  /** Relationship role (e.g., "parent" for part_of) */
  role?: string;
}

/** Relationships grouped by junction table name */
export interface Relationships {
  /** Maps junction table name (e.g., "task_part_of") to entries */
  [relationshipType: string]: RelationshipEntry[];
}

/** A row parsed from a Mermaid `class` declaration within a namespace */
export interface Row {
  /** Row name from the `name:` attribute in the class body */
  name: string;
  /** Class identifier (e.g., `EAR`), unique across the entire file */
  anchor: string;
  /** Explicit primary key from `id:` attribute in class body (optional) */
  pk?: number;
  /** Column values from key: value attributes in the class body */
  columns: ColumnValues;
  /**
   * Relationships to other rows.
   * Populated when extracting from a database; empty when parsing Mermaid
   * (relationships are instead represented as junction table rows).
   */
  relationships: Relationships;
  /** Position in source document (for error reporting, markdown parser only) */
  sourcePosition?: {
    line: number;
    column: number;
  };
}

/** A table parsed from a Mermaid `namespace` block */
export interface Table {
  /** Table name (namespace identifier, used directly in SQL) */
  name: string;
  /** Schema parsed from the commented CREATE TABLE in the Mermaid header */
  schema: TableSchema;
  /** Raw SQL string from the header comment block */
  rawSql: string;
  /** Rows (class declarations) defined within this namespace */
  rows: Row[];
}

/**
 * Maps a Mermaid arrow token to a junction table and its FK columns.
 * Parsed from header comment directives like:
 *   `%% parent_task_id *-- child_task_id : task_part_of`
 */
export interface ArrowMapping {
  /** Junction table name */
  junctionTable: string;
  /** FK column name for the left-hand side of the arrow */
  leftColumn: string;
  /** Mermaid arrow token (e.g., "*--", "..>", "<|--") */
  arrowToken: string;
  /** FK column name for the right-hand side of the arrow */
  rightColumn: string;
}

/** A database parsed from a Mermaid classDiagram file */
export interface Database {
  /** Database name (from frontmatter `title:`) */
  name: string;
  /** Generated anchor/slug for the database */
  anchor: string;
  /** Tables (both data tables and junction tables) */
  tables: Table[];
  /** Arrow-to-junction-table mappings for lossless Mermaid round-trip */
  arrowMappings?: ArrowMapping[];
}

/** Result of parsing a Mermaid classDiagram file */
export interface ParseResult {
  /** Databases found in the document (typically one per file) */
  databases: Database[];
  /** Non-fatal parsing warnings */
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
