/**
 * Row data utilities for extracting database-insertable data from Row objects.
 */

import type { Row } from '../types.js';

/**
 * Build row data suitable for database insertion.
 * Extracts non-metadata columns from a Row object.
 *
 * Filters out:
 * - pk (primary key - auto-generated or managed separately)
 * - Internal metadata columns starting with underscore (_lhs_anchor, _rhs_anchor)
 *
 * Includes:
 * - name (required field)
 * - anchor (required field)
 * - All other user-defined columns
 */
export function buildRowData(row: Row): Record<string, any> {
  const data: Record<string, any> = {
    name: row.name,
    anchor: row.anchor,
  };

  // Add all columns except internal metadata
  for (const [key, value] of Object.entries(row.columns)) {
    // Skip internal metadata columns (those starting with underscore)
    if (!key.startsWith('_')) {
      data[key] = value;
    }
  }

  return data;
}
