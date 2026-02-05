/**
 * Arrow parsing and relationship resolution for Mermaid classDiagram.
 * Creates junction table rows from arrow declarations.
 */

import type { TableSchema, Row, ColumnValues } from '@m2sql/model';
import type { ArrowMapping } from './mermaid-header.js';
import { createSlugger, generateAnchor } from './slugify.js';

export interface ParsedArrow {
  lhsAnchor: string;
  arrowToken: string;
  rhsAnchor: string;
  label?: string;
}

export interface JunctionTableRow {
  junctionTable: string;
  lhsAnchor: string;
  rhsAnchor: string;
  label?: string;
}

/**
 * Parse a single arrow line into structured data.
 * Format: LHS arrow RHS [: "label"]
 */
export function parseArrow(line: string): ParsedArrow | null {
  // Match: anchor arrow anchor [: "label"]
  // Arrow tokens can include: * . - < > |
  const match = line.match(/^(\w+)\s+([*.\-<>|]+)\s+(\w+)(?:\s*:\s*"([^"]*)")?/);
  if (!match) return null;

  const [, lhsAnchor, arrowToken, rhsAnchor, label] = match;
  if (!lhsAnchor || !arrowToken || !rhsAnchor) return null;

  return {
    lhsAnchor,
    arrowToken,
    rhsAnchor,
    label,
  };
}

/**
 * Resolve arrows to junction table rows using explicit arrow mappings.
 * Creates first-class rows for junction tables.
 */
export function resolveArrowsToJunctionRows(
  arrows: string[],
  arrowMappings: Map<string, ArrowMapping>,
  anchorToTable: Map<string, string>,
  schemas: Map<string, TableSchema>
): {
  junctionRows: JunctionTableRow[];
  errors: string[];
} {
  const junctionRows: JunctionTableRow[] = [];
  const errors: string[] = [];

  for (const arrowLine of arrows) {
    const arrow = parseArrow(arrowLine);
    if (!arrow) {
      errors.push(`Invalid arrow syntax: ${arrowLine}`);
      continue;
    }

    const { lhsAnchor, arrowToken, rhsAnchor, label } = arrow;

    // Check if arrow mapping exists
    const mapping = arrowMappings.get(arrowToken);
    if (!mapping) {
      errors.push(`No arrow mapping found for token: ${arrowToken}`);
      continue;
    }

    const { leftColumn, rightColumn, junctionTable } = mapping;

    // Get table names for LHS and RHS
    const lhsTable = anchorToTable.get(lhsAnchor);
    const rhsTable = anchorToTable.get(rhsAnchor);

    if (!lhsTable) {
      errors.push(`Unresolved anchor: ${lhsAnchor}`);
      continue;
    }

    if (!rhsTable) {
      errors.push(`Unresolved anchor: ${rhsAnchor}`);
      continue;
    }

    // Get junction table schema
    const junctionSchema = schemas.get(junctionTable);
    if (!junctionSchema) {
      errors.push(`Junction table not found: ${junctionTable}`);
      continue;
    }

    // Find the FK columns in the junction table
    const leftFkCol = junctionSchema.columns.find(c => c.name === leftColumn);
    const rightFkCol = junctionSchema.columns.find(c => c.name === rightColumn);

    if (!leftFkCol || !leftFkCol.references) {
      errors.push(`Column ${leftColumn} not found or not a FK in ${junctionTable}`);
      continue;
    }

    if (!rightFkCol || !rightFkCol.references) {
      errors.push(`Column ${rightColumn} not found or not a FK in ${junctionTable}`);
      continue;
    }

    // Validate FK tables match
    const leftFkTable = leftFkCol.references.table;
    const rightFkTable = rightFkCol.references.table;

    if (leftFkTable !== lhsTable && leftFkTable !== rhsTable) {
      errors.push(`FK column ${leftColumn} references ${leftFkTable}, but arrow connects ${lhsTable} and ${rhsTable}`);
      continue;
    }

    if (rightFkTable !== lhsTable && rightFkTable !== rhsTable) {
      errors.push(`FK column ${rightColumn} references ${rightFkTable}, but arrow connects ${lhsTable} and ${rhsTable}`);
      continue;
    }

    // Create junction table row (no interpretation of direction needed)
    junctionRows.push({
      junctionTable,
      lhsAnchor,
      rhsAnchor,
      label,
    });
  }

  return { junctionRows, errors };
}
