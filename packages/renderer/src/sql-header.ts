/**
 * SQL header generation for Mermaid files.
 * Renders CREATE TABLE statements with %% comment prefix.
 */

import type { Table } from '@m2sql/model';

/**
 * Format a CREATE TABLE statement with %% prefix on each line.
 * Removes auto-managed columns if they use default types.
 */
function formatCreateTable(rawSql: string): string {
  const lines = rawSql.trim().split('\n');
  return lines.map(line => `%% ${line}`).join('\n');
}

/**
 * Reconstruct a CREATE TABLE statement from schema.
 * Used when rawSql is not available.
 */
function reconstructCreateTable(table: Table): string {
  const { schema } = table;
  const lines: string[] = [];

  lines.push(`CREATE TABLE ${schema.name} (`);

  const columnLines: string[] = [];

  for (const col of schema.columns) {
    // Skip auto-managed columns (they'll be injected during compilation)
    if (col.name === 'id' && col.type === 'INTEGER' && col.primaryKey) continue;
    if (col.name === 'name' && col.type === 'TEXT') continue;
    if (col.name === 'anchor' && col.type === 'TEXT' && col.unique) continue;

    let line = `  ${col.name} ${col.type}`;

    if (col.primaryKey) line += ' PRIMARY KEY';
    if (!col.nullable) line += ' NOT NULL';
    if (col.unique && !col.primaryKey) line += ' UNIQUE';
    if (col.defaultValue !== null) {
      if (typeof col.defaultValue === 'string') {
        line += ` DEFAULT '${col.defaultValue}'`;
      } else {
        line += ` DEFAULT ${col.defaultValue}`;
      }
    }

    if (col.references) {
      line += ` REFERENCES ${col.references.table}(${col.references.column})`;
      if (col.references.onDelete) {
        line += ` ON DELETE ${col.references.onDelete}`;
      }
    }

    columnLines.push(line);
  }

  // Add table-level PRIMARY KEY if composite
  if (schema.primaryKey.length > 1) {
    columnLines.push(`  PRIMARY KEY (${schema.primaryKey.join(', ')})`);
  }

  lines.push(columnLines.join(',\n'));
  lines.push(');');

  return lines.join('\n');
}

/**
 * Render SQL header for all tables.
 * Returns CREATE TABLE statements with %% prefix.
 */
export function renderSqlHeader(tables: Table[]): string {
  const sections: string[] = [];

  for (const table of tables) {
    let sql: string;

    if (table.rawSql && table.rawSql.trim()) {
      sql = formatCreateTable(table.rawSql);
    } else {
      sql = formatCreateTable(reconstructCreateTable(table));
    }

    sections.push(sql);
  }

  return sections.join('\n%%\n');
}
