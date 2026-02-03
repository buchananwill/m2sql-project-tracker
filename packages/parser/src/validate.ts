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

  // Validate column values against schema
  for (const database of databases) {
    for (const table of database.tables) {
      const schemaColumns = new Set(table.schema.columns.map(c => c.name));

      for (const row of table.rows) {
        for (const colName of Object.keys(row.columns)) {
          if (!schemaColumns.has(colName)) {
            errors.push({
              type: 'missing_column',
              message: `Unknown column ${colName} in table ${table.name}`,
              table: table.name,
              row: row.name,
              column: colName,
            });
          }
        }

        // Note: We don't validate required columns here because:
        // - 'name' and 'anchor' are populated from the heading
        // - Many columns have defaults in the actual SQL
        // - The SQLite compiler will catch missing required values
      }
    }
  }

  // Validate relationship references
  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        for (const [_relType, entries] of Object.entries(row.relationships)) {
          for (const entry of entries) {
            if (!anchorMap.has(entry.targetAnchor)) {
              errors.push({
                type: 'unresolved_reference',
                message: `Unresolved reference in ${row.name}: ${entry.targetAnchor}`,
                table: table.name,
                row: row.name,
              });
            }
          }
        }
      }
    }
  }

  // Check for cycles in part_of relationships
  const partOfCycles = detectPartOfCycles(databases, anchorMap);
  errors.push(...partOfCycles);

  // Check for cycles in depends_on relationships
  const dependsCycles = detectDependsCycles(databases, anchorMap);
  errors.push(...dependsCycles);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect cycles in part_of (parent-child) relationships.
 */
function detectPartOfCycles(
  databases: Database[],
  anchorMap: Map<string, { database: Database; table: Table; row: Row }>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list: child -> parent
  const parentMap = new Map<string, string[]>();

  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        const partOfEntries = row.relationships['Part Of'] ?? [];
        const parents = partOfEntries
          .filter(e => e.role === 'parent')
          .map(e => e.targetAnchor);

        if (parents.length > 0) {
          parentMap.set(row.anchor, parents);
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
        message: `Cycle detected in part_of: ${cycle.join(' -> ')}`,
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
 * Detect cycles in depends_on relationships.
 */
function detectDependsCycles(
  databases: Database[],
  anchorMap: Map<string, { database: Database; table: Table; row: Row }>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list: task -> dependencies
  const depsMap = new Map<string, string[]>();

  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        const dependsEntries = row.relationships['Depends On'] ?? [];
        const deps = dependsEntries.map(e => e.targetAnchor);

        if (deps.length > 0) {
          depsMap.set(row.anchor, deps);
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
        message: `Cycle detected in depends_on: ${cycle.join(' -> ')}`,
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
