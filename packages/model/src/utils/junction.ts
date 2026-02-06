/**
 * Junction table detection utilities.
 * Identifies junction tables based on schema or row data patterns.
 */

import type { TableSchema, Row } from '../types.js';

/**
 * Identify junction table based on schema analysis.
 * A junction table has:
 * 1. A composite primary key with 2+ columns
 * 2. At least 2 foreign key columns
 * 3. The FK columns form part of the primary key
 *
 * @param schema - Table schema with column definitions
 * @returns true if table appears to be a junction table
 */
export function isJunctionTableBySchema(schema: TableSchema): boolean {
  const pkColumns = new Set(schema.primaryKey);
  const fkColumns = schema.columns.filter(c => c.references);

  // Must have at least 2 FK columns
  if (fkColumns.length < 2) {
    return false;
  }

  // Must have at least 2 PK columns
  if (pkColumns.size < 2) {
    return false;
  }

  // At least 2 FK columns must be part of the PK
  const fkInPk = fkColumns.filter(fk => pkColumns.has(fk.name));
  return fkInPk.length >= 2;
}

/**
 * Identify junction table based on row data analysis.
 * A junction table row contains:
 * - _lhs_anchor (left-hand side anchor reference)
 * - _rhs_anchor (right-hand side anchor reference)
 *
 * These are metadata columns added by the parser when processing Mermaid arrows.
 *
 * @param rows - Array of table rows
 * @returns true if rows contain junction table metadata
 */
export function isJunctionTableByRows(rows: Row[]): boolean {
  if (rows.length === 0) {
    return false;
  }

  // Check if any row has both _lhs_anchor and _rhs_anchor
  return rows.some(
    row =>
      row.columns['_lhs_anchor'] !== undefined &&
      row.columns['_rhs_anchor'] !== undefined
  );
}
