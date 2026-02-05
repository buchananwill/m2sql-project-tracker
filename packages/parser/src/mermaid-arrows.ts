/**
 * Arrow parsing and relationship resolution for Mermaid classDiagram.
 * Maps arrows to junction tables and validates foreign key relationships.
 */

import type { TableSchema, RelationshipEntry } from '@m2sql/model';
import type { ArrowMapping } from './mermaid-header.js';

export interface ParsedArrow {
  lhsAnchor: string;
  arrowToken: string;
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
 * Resolve arrows to relationship entries using explicit arrow mappings.
 * Uses FK column names to determine relationship directionality.
 */
export function resolveArrowsToRelationships(
  arrows: string[],
  arrowMappings: Map<string, ArrowMapping>,
  anchorToTable: Map<string, string>,
  schemas: Map<string, TableSchema>
): {
  relationships: Map<string, RelationshipEntry[]>; // anchor -> relationships
  errors: string[];
} {
  const relationships = new Map<string, RelationshipEntry[]>();
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

    // Determine which anchor connects to which FK column
    const leftFkTable = leftFkCol.references.table;
    const rightFkTable = rightFkCol.references.table;

    // Validate FK tables match
    if (leftFkTable !== lhsTable && leftFkTable !== rhsTable) {
      errors.push(`FK column ${leftColumn} references ${leftFkTable}, but arrow connects ${lhsTable} and ${rhsTable}`);
      continue;
    }

    if (rightFkTable !== lhsTable && rightFkTable !== rhsTable) {
      errors.push(`FK column ${rightColumn} references ${rightFkTable}, but arrow connects ${lhsTable} and ${rhsTable}`);
      continue;
    }

    // Determine relationship direction based on FK column references
    // If leftColumn references lhsTable, then LHS connects to leftColumn
    // If rightColumn references rhsTable, then RHS connects to rightColumn
    // The relationship points FROM the entity TO the entity referenced by the opposite column

    let sourceAnchor: string;
    let targetAnchor: string;

    if (leftFkTable === lhsTable && rightFkTable === rhsTable) {
      // LHS -> leftColumn, RHS -> rightColumn
      // Relationship: RHS points to LHS (following UML convention)
      sourceAnchor = rhsAnchor;
      targetAnchor = lhsAnchor;
    } else if (leftFkTable === rhsTable && rightFkTable === lhsTable) {
      // RHS -> leftColumn, LHS -> rightColumn
      // Relationship: LHS points to RHS
      sourceAnchor = lhsAnchor;
      targetAnchor = rhsAnchor;
    } else {
      errors.push(`Cannot determine relationship direction for ${lhsAnchor} ${arrowToken} ${rhsAnchor}`);
      continue;
    }

    // Create unidirectional relationship
    const sourceRelationships = relationships.get(sourceAnchor) || [];
    sourceRelationships.push({
      targetAnchor,
      displayText: label || targetAnchor,
      role: junctionTable,
    });
    relationships.set(sourceAnchor, sourceRelationships);
  }

  return { relationships, errors };
}
