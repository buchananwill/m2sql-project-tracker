/**
 * Validation utilities for parsed models.
 * Checks for schema compliance, duplicate anchors, unresolved references, and cycles.
 */

import type {
  Database,
  Table,
  Row,
  ValidationResult,
  ValidationError,
} from '@m2sql/model';
import { buildAnchorMap } from './parse.js';

/**
 * Validate a parsed model for correctness.
 */
export function validateModel(databases: Database[]): ValidationResult {
  const errors: ValidationError[] = [];
  const anchorMap = buildAnchorMap(databases);

  // Check for duplicate anchors (should already be handled by slugger, but verify)
  const seenAnchors = new Set<string>();
  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        if (seenAnchors.has(row.anchor)) {
          errors.push({
            type: 'duplicate_anchor',
            message: `Duplicate anchor: ${row.anchor}`,
            table: table.name,
            row: row.name,
          });
        }
        seenAnchors.add(row.anchor);
      }
    }
  }

  // Check for unique row names within each table
  for (const database of databases) {
    for (const table of database.tables) {
      const seenNames = new Set<string>();
      for (const row of table.rows) {
        if (seenNames.has(row.name)) {
          errors.push({
            type: 'duplicate_anchor',
            message: `Duplicate row name in table ${table.name}: ${row.name}`,
            table: table.name,
            row: row.name,
          });
        }
        seenNames.add(row.name);
      }
    }
  }

  // Note: We don't validate column names against schema because:
  // - Per spec: "If a row contains an attribute whose key does not match any column
  //   in the declared schema, the parser adds a new column with that name and type TEXT"
  // - Undeclared columns are auto-added during compilation (schema flexibility)
  // - Required columns are validated during SQLite compilation
  // - Temporary columns like _lhs_anchor and _rhs_anchor are used for junction table
  //   anchor resolution and are replaced with FK IDs during compilation

  // Validate junction table references
  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        // Check if this is a junction table row
        const lhsAnchor = row.columns['_lhs_anchor'];
        const rhsAnchor = row.columns['_rhs_anchor'];

        if (lhsAnchor !== undefined && rhsAnchor !== undefined) {
          // This is a junction table row - validate anchors exist
          if (!anchorMap.has(lhsAnchor as string)) {
            errors.push({
              type: 'unresolved_reference',
              message: `Unresolved anchor in junction table ${table.name}: ${lhsAnchor}`,
              table: table.name,
              row: row.name,
            });
          }
          if (!anchorMap.has(rhsAnchor as string)) {
            errors.push({
              type: 'unresolved_reference',
              message: `Unresolved anchor in junction table ${table.name}: ${rhsAnchor}`,
              table: table.name,
              row: row.name,
            });
          }
        }
      }
    }
  }

  // Check for cycles in hierarchical relationships (part_of, contains, etc.)
  const partOfCycles = detectHierarchicalCycles(databases, anchorMap);
  errors.push(...partOfCycles);

  // Check for cycles in dependency relationships (depends_on, requires, etc.)
  const dependsCycles = detectDependencyCycles(databases, anchorMap);
  errors.push(...dependsCycles);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect cycles in hierarchical (part_of) relationships.
 * Checks junction tables with _lhs_anchor and _rhs_anchor columns.
 */
function detectHierarchicalCycles(
  databases: Database[],
  anchorMap: Map<string, { database: Database; table: Table; row: Row }>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list: child -> parent
  const parentMap = new Map<string, string[]>();

  for (const database of databases) {
    for (const table of database.tables) {
      // Check if this is a hierarchical junction table (e.g., task_part_of)
      const isHierarchicalJunctionTable = table.name.endsWith('_part_of');
      const hasJunctionColumns = table.rows.some(
        r => r.columns['_lhs_anchor'] !== undefined && r.columns['_rhs_anchor'] !== undefined
      );

      if (isHierarchicalJunctionTable && hasJunctionColumns) {
        // For *-- arrow: parent *-- child means child is part of parent
        // Junction table stores: parent_task_id *-- child_task_id : task_part_of
        // So _lhs_anchor is parent, _rhs_anchor is child
        // Build map: child -> [parents]
        for (const row of table.rows) {
          const childAnchor = row.columns['_rhs_anchor'] as string;
          const parentAnchor = row.columns['_lhs_anchor'] as string;

          if (childAnchor && parentAnchor) {
            const existing = parentMap.get(childAnchor) || [];
            existing.push(parentAnchor);
            parentMap.set(childAnchor, existing);
          }
        }
      }
    }
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(anchor: string, path: string[]): boolean {
    if (inStack.has(anchor)) {
      const cycleStart = path.indexOf(anchor);
      const cycle = path.slice(cycleStart).concat(anchor);
      errors.push({
        type: 'cycle_detected',
        message: `Cycle detected in hierarchical relationship: ${cycle.join(' -> ')}`,
      });
      return true;
    }

    if (visited.has(anchor)) return false;

    visited.add(anchor);
    inStack.add(anchor);

    const parents = parentMap.get(anchor) ?? [];
    for (const parent of parents) {
      if (dfs(parent, [...path, anchor])) {
        return true;
      }
    }

    inStack.delete(anchor);
    return false;
  }

  for (const anchor of parentMap.keys()) {
    if (!visited.has(anchor)) {
      dfs(anchor, []);
    }
  }

  return errors;
}

/**
 * Detect cycles in dependency (depends_on) relationships.
 * Checks junction tables with _lhs_anchor and _rhs_anchor columns.
 */
function detectDependencyCycles(
  databases: Database[],
  anchorMap: Map<string, { database: Database; table: Table; row: Row }>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list: dependent -> prerequisite
  const depsMap = new Map<string, string[]>();

  for (const database of databases) {
    for (const table of database.tables) {
      // Check if this is a dependency junction table (e.g., task_depends_on)
      const isDependencyJunctionTable = table.name.endsWith('_depends_on');
      const hasJunctionColumns = table.rows.some(
        r => r.columns['_lhs_anchor'] !== undefined && r.columns['_rhs_anchor'] !== undefined
      );

      if (isDependencyJunctionTable && hasJunctionColumns) {
        // For ..> arrow: dependent ..> prerequisite
        // Junction table stores: dependent_task_id ..> prerequisite_task_id : task_depends_on
        // So _lhs_anchor is dependent, _rhs_anchor is prerequisite
        // Build map: dependent -> [prerequisites]
        for (const row of table.rows) {
          const dependentAnchor = row.columns['_lhs_anchor'] as string;
          const prerequisiteAnchor = row.columns['_rhs_anchor'] as string;

          if (dependentAnchor && prerequisiteAnchor) {
            const existing = depsMap.get(dependentAnchor) || [];
            existing.push(prerequisiteAnchor);
            depsMap.set(dependentAnchor, existing);
          }
        }
      }
    }
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(anchor: string, path: string[]): boolean {
    if (inStack.has(anchor)) {
      const cycleStart = path.indexOf(anchor);
      const cycle = path.slice(cycleStart).concat(anchor);
      errors.push({
        type: 'cycle_detected',
        message: `Cycle detected in dependency relationship: ${cycle.join(' -> ')}`,
      });
      return true;
    }

    if (visited.has(anchor)) return false;

    visited.add(anchor);
    inStack.add(anchor);

    const deps = depsMap.get(anchor) ?? [];
    for (const dep of deps) {
      if (dfs(dep, [...path, anchor])) {
        return true;
      }
    }

    inStack.delete(anchor);
    return false;
  }

  for (const anchor of depsMap.keys()) {
    if (!visited.has(anchor)) {
      dfs(anchor, []);
    }
  }

  return errors;
}
