/**
 * Namespace (table) and class (row) rendering for Mermaid classDiagram.
 */

import type { Row, RowValue } from '@m2sql/model';

/**
 * Format a row value for Mermaid class attribute.
 */
function formatValue(value: RowValue): string {
  if (value === null) return '';
  if (typeof value === 'string') {
    // Quote strings if they contain spaces or special characters
    if (/[\s:]/.test(value)) {
      return `"${value}"`;
    }
    return value;
  }
  return String(value);
}

/**
 * Render a single class (row) within a namespace.
 * Includes id: for round-trip UPSERT.
 */
function renderClass(row: Row, tableName: string): string {
  const lines: string[] = [];
  const style = tableName; // Use table name as style class

  lines.push(`    class ${row.anchor}:::${style}{`);

  // Always include id for round-trip UPSERT (if present)
  if (row.pk !== undefined) {
    lines.push(`    id: ${row.pk}`);
  }

  // Always include name
  lines.push(`    name: ${formatValue(row.name)}`);

  // Include other columns (exclude auto-managed: id, name, anchor)
  const sortedColumns = Object.entries(row.columns)
    .filter(([key]) => key !== 'id' && key !== 'name' && key !== 'anchor')
    .filter(([key]) => !key.startsWith('_')) // Exclude temp columns
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, value] of sortedColumns) {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`    ${key}: ${formatValue(value)}`);
    }
  }

  lines.push('    }');

  return lines.join('\n');
}

/**
 * Render a namespace (table) block with its classes (rows).
 */
export function renderNamespace(tableName: string, rows: Row[]): string {
  const lines: string[] = [];

  lines.push(`namespace ${tableName} {`);

  for (const row of rows) {
    lines.push(renderClass(row, tableName));
    lines.push(''); // Blank line between classes
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Render classDef style declarations for tables.
 * Creates one classDef per table with a simple color scheme.
 */
export function renderClassDefs(tableNames: string[]): string {
  const defs: string[] = [];

  // Simple color scheme - you can customize this
  const colors = [
    { fill: '#eeeeff', stroke: '#00c' },
    { fill: '#eeffee', stroke: '#0c0' },
    { fill: '#ffeeee', stroke: '#c00' },
    { fill: '#ffffee', stroke: '#cc0' },
    { fill: '#ffeeff', stroke: '#c0c' },
    { fill: '#eeffff', stroke: '#0cc' },
  ];

  for (let i = 0; i < tableNames.length; i++) {
    const table = tableNames[i]!;
    const color = colors[i % colors.length]!;
    defs.push(`classDef ${table} fill:${color.fill},stroke:${color.stroke}`);
  }

  return defs.join('\n');
}
