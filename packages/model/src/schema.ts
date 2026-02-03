/**
 * SQL schema parsing utilities.
 * Parses CREATE TABLE statements into structured TableSchema objects.
 */

import type { ColumnDefinition, SqlColumnType, TableSchema } from './types.js';

/** Parse a SQL type string to our normalized type */
function parseSqlType(typeStr: string): SqlColumnType {
  const upper = typeStr.toUpperCase().trim();
  if (upper.startsWith('INT')) return 'INTEGER';
  if (upper.startsWith('TEXT') || upper.startsWith('VARCHAR') || upper.startsWith('CHAR')) return 'TEXT';
  if (upper.startsWith('REAL') || upper.startsWith('FLOAT') || upper.startsWith('DOUBLE')) return 'REAL';
  if (upper.startsWith('BLOB')) return 'BLOB';
  // Default to TEXT for unknown types
  return 'TEXT';
}

/** Parse a default value expression */
function parseDefaultValue(expr: string): string | number | null {
  const trimmed = expr.trim();

  // NULL
  if (trimmed.toUpperCase() === 'NULL') return null;

  // Numeric
  const num = Number(trimmed);
  if (!isNaN(num)) return num;

  // String literal (single quotes)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  // Expression (e.g., strftime(...)) - return as string
  return trimmed;
}

/** Extract ON DELETE action from REFERENCES clause */
function parseOnDelete(refClause: string): 'CASCADE' | 'SET NULL' | 'RESTRICT' | undefined {
  const match = refClause.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT)/i);
  if (!match) return undefined;
  const action = match[1]?.toUpperCase().replace(/\s+/, ' ');
  if (action === 'CASCADE') return 'CASCADE';
  if (action === 'SET NULL') return 'SET NULL';
  if (action === 'RESTRICT') return 'RESTRICT';
  return undefined;
}

/** Parse a column definition line */
function parseColumnDefinition(line: string): ColumnDefinition | null {
  // Skip table-level constraints
  if (/^\s*(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)/i.test(line)) {
    return null;
  }

  // Match: column_name TYPE [constraints...]
  const match = line.match(/^\s*(\w+)\s+(\w+)(.*)$/);
  if (!match) return null;

  const [, name, typeStr, rest] = match;
  if (!name || !typeStr) return null;

  const upperRest = rest?.toUpperCase() ?? '';

  const column: ColumnDefinition = {
    name,
    type: parseSqlType(typeStr),
    nullable: !upperRest.includes('NOT NULL'),
    primaryKey: upperRest.includes('PRIMARY KEY'),
    unique: upperRest.includes('UNIQUE'),
    defaultValue: null,
  };

  // Parse DEFAULT
  const defaultMatch = rest?.match(/DEFAULT\s+(\([^)]+\)|'[^']*'|\S+)/i);
  if (defaultMatch?.[1]) {
    column.defaultValue = parseDefaultValue(defaultMatch[1]);
  }

  // Parse REFERENCES
  const refMatch = rest?.match(/REFERENCES\s+(\w+)\s*\((\w+)\)([^,]*)/i);
  if (refMatch) {
    column.references = {
      table: refMatch[1]!,
      column: refMatch[2]!,
      onDelete: parseOnDelete(refMatch[3] ?? ''),
    };
  }

  return column;
}

/** Parse table-level PRIMARY KEY constraint */
function parseTablePrimaryKey(sql: string): string[] {
  const match = sql.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
  if (!match?.[1]) return [];
  return match[1].split(',').map(s => s.trim());
}

/** Parse table-level UNIQUE constraints */
function parseTableUniqueConstraints(sql: string): string[][] {
  const constraints: string[][] = [];
  const regex = /UNIQUE\s*\(([^)]+)\)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    if (match[1]) {
      constraints.push(match[1].split(',').map(s => s.trim()));
    }
  }
  return constraints;
}

/** Parse CHECK constraints */
function parseCheckConstraints(sql: string): string[] {
  const constraints: string[] = [];
  const regex = /CHECK\s*\(([^)]+)\)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    if (match[1]) {
      constraints.push(match[1].trim());
    }
  }
  return constraints;
}

/** Parse table-level FOREIGN KEY constraints and apply to columns */
function applyTableForeignKeys(sql: string, columns: ColumnDefinition[]): void {
  const regex = /FOREIGN\s+KEY\s*\((\w+)\)\s+REFERENCES\s+(\w+)\s*\((\w+)\)([^,)]*)/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    const [, colName, refTable, refCol, rest] = match;
    const column = columns.find(c => c.name === colName);
    if (column && refTable && refCol) {
      column.references = {
        table: refTable,
        column: refCol,
        onDelete: parseOnDelete(rest ?? ''),
      };
    }
  }
}

/**
 * Parse a CREATE TABLE SQL statement into a TableSchema.
 * Handles both inline column constraints and table-level constraints.
 */
export function parseCreateTable(sql: string): TableSchema {
  // Extract table name
  const tableMatch = sql.match(/CREATE\s+TABLE\s+(\w+)\s*\(/i);
  if (!tableMatch?.[1]) {
    throw new Error('Invalid CREATE TABLE statement: could not extract table name');
  }

  const tableName = tableMatch[1];

  // Extract content between parentheses (handling nested parens for defaults)
  const startParen = sql.indexOf('(');
  let depth = 1;
  let endParen = startParen + 1;
  while (depth > 0 && endParen < sql.length) {
    if (sql[endParen] === '(') depth++;
    else if (sql[endParen] === ')') depth--;
    endParen++;
  }

  const content = sql.slice(startParen + 1, endParen - 1);

  // Split by commas (careful with nested expressions)
  const lines: string[] = [];
  let current = '';
  depth = 0;
  for (const char of content) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      lines.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    lines.push(current.trim());
  }

  // Parse columns
  const columns: ColumnDefinition[] = [];
  for (const line of lines) {
    const col = parseColumnDefinition(line);
    if (col) {
      columns.push(col);
    }
  }

  // Collect primary keys from column definitions
  const primaryKey = columns.filter(c => c.primaryKey).map(c => c.name);

  // Parse table-level constraints
  const tablePK = parseTablePrimaryKey(sql);
  if (tablePK.length > 0 && primaryKey.length === 0) {
    primaryKey.push(...tablePK);
  }

  // Apply table-level foreign keys
  applyTableForeignKeys(sql, columns);

  return {
    name: tableName,
    columns,
    primaryKey,
    uniqueConstraints: parseTableUniqueConstraints(sql),
    checkConstraints: parseCheckConstraints(sql),
  };
}

/**
 * Validate that column values match the schema.
 */
export function validateColumnValues(
  schema: TableSchema,
  values: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [colName, value] of Object.entries(values)) {
    const colDef = schema.columns.find(c => c.name === colName);
    if (!colDef) {
      errors.push(`Unknown column: ${colName}`);
      continue;
    }

    if (value === null && !colDef.nullable && colDef.defaultValue === null) {
      errors.push(`Column ${colName} is NOT NULL but received null`);
    }

    // Type checking (loose, since markdown values are strings)
    if (value !== null && colDef.type === 'INTEGER') {
      const num = Number(value);
      if (isNaN(num) || !Number.isInteger(num)) {
        errors.push(`Column ${colName} expects INTEGER but got: ${value}`);
      }
    }

    if (value !== null && colDef.type === 'REAL') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`Column ${colName} expects REAL but got: ${value}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
