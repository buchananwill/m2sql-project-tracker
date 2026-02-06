/**
 * Anchor mapping utilities for resolving relationships between rows.
 * Builds bidirectional maps between row primary keys and anchor strings.
 */

import type { Table } from '../types.js';

/**
 * Build a map from row ID (primary key) to anchor string.
 * Used to resolve foreign key IDs to anchors when extracting junction tables.
 *
 * @param tables - Array of data tables with rows
 * @returns Map from numeric ID to anchor string
 */
export function buildIdToAnchorMap(tables: Table[]): Map<number, string> {
  const map = new Map<number, string>();

  for (const table of tables) {
    for (const row of table.rows) {
      if (row.pk !== undefined && row.anchor) {
        map.set(row.pk, row.anchor);
      }
    }
  }

  return map;
}

/**
 * Build a map from anchor string to row ID (primary key).
 * Used to resolve anchor references to foreign key IDs when inserting junction tables.
 *
 * @param tables - Array of data tables with rows
 * @returns Map from anchor string to numeric ID
 */
export function buildAnchorToIdMap(tables: Table[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const table of tables) {
    for (const row of table.rows) {
      if (row.pk !== undefined && row.anchor) {
        map.set(row.anchor, row.pk);
      }
    }
  }

  return map;
}

/**
 * Resolve junction table row anchors from foreign key IDs.
 * Takes a junction row with FK columns and resolves them to _lhs_anchor and _rhs_anchor.
 *
 * @param row - Junction table row data
 * @param fkColumns - Array of FK column names (first two are used as LHS and RHS)
 * @param idToAnchorMap - Map from FK ID to anchor string
 * @returns Object with resolved _lhs_anchor and _rhs_anchor (if resolvable)
 */
export function resolveJunctionAnchors(
  row: Record<string, any>,
  fkColumns: string[],
  idToAnchorMap: Map<number, string>
): { _lhs_anchor?: string; _rhs_anchor?: string } {
  const result: { _lhs_anchor?: string; _rhs_anchor?: string } = {};

  if (fkColumns.length >= 2) {
    const leftId = row[fkColumns[0]!] as number | undefined;
    const rightId = row[fkColumns[1]!] as number | undefined;

    if (leftId !== undefined) {
      result._lhs_anchor = idToAnchorMap.get(leftId);
    }
    if (rightId !== undefined) {
      result._rhs_anchor = idToAnchorMap.get(rightId);
    }
  }

  return result;
}
