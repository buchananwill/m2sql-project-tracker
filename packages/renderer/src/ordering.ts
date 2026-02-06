/**
 * Row ordering logic for Mermaid export.
 * Implements topological sort based on composition and dependency relationships.
 */

import type { Row, Table, ArrowMapping } from '@m2sql/model';

export interface OrderedRow extends Row {
  /** Table this row belongs to */
  tableName: string;
}

interface RowNode {
  row: Row;
  tableName: string;
  anchor: string;
  parents: Set<string>; // Composition parents
  dependencies: Set<string>; // Dependency prerequisites
  priority: number;
  createdUtc: number;
}

/**
 * Build a graph of row relationships from junction tables.
 */
function buildRowGraph(
  dataTables: Table[],
  junctionTables: Table[],
  arrowMappings: Map<string, ArrowMapping>
): Map<string, RowNode> {
  const graph = new Map<string, RowNode>();

  // Initialize nodes for all rows in data tables
  for (const table of dataTables) {
    for (const row of table.rows) {
      const priority = typeof row.columns['priority'] === 'number'
        ? row.columns['priority']
        : Number.MAX_SAFE_INTEGER;

      const createdUtc = typeof row.columns['created_utc'] === 'number'
        ? row.columns['created_utc']
        : typeof row.columns['created_utc'] === 'string'
        ? new Date(row.columns['created_utc']).getTime()
        : 0;

      graph.set(row.anchor, {
        row,
        tableName: table.name,
        anchor: row.anchor,
        parents: new Set(),
        dependencies: new Set(),
        priority,
        createdUtc,
      });
    }
  }

  // Build relationship edges from junction tables
  for (const junctionTable of junctionTables) {
    const mapping = arrowMappings.get(junctionTable.name);
    if (!mapping) continue;

    const isComposition = mapping.arrowToken === '*--' || mapping.arrowToken === 'o--';
    const isDependency = mapping.arrowToken === '..>' || mapping.arrowToken.includes('..');

    for (const jRow of junctionTable.rows) {
      const lhsAnchor = jRow.columns['_lhs_anchor'] as string | undefined;
      const rhsAnchor = jRow.columns['_rhs_anchor'] as string | undefined;

      if (!lhsAnchor || !rhsAnchor) continue;

      const lhsNode = graph.get(lhsAnchor);
      const rhsNode = graph.get(rhsAnchor);

      if (!lhsNode || !rhsNode) continue;

      // LHS arrow RHS: LHS is parent/prerequisite, RHS is child/dependent
      if (isComposition) {
        rhsNode.parents.add(lhsAnchor); // RHS has parent LHS
      } else if (isDependency) {
        lhsNode.dependencies.add(rhsAnchor); // LHS depends on RHS
      }
    }
  }

  return graph;
}

/**
 * Topological sort with multiple ordering criteria.
 * Returns rows sorted by:
 * 1. Composition hierarchy (parents before children)
 * 2. Dependency order (prerequisites before dependents)
 * 3. Priority ascending (lower = higher importance)
 * 4. created_utc ascending (older first)
 * 5. Anchor alphabetically (stable tiebreaker)
 */
function topologicalSort(graph: Map<string, RowNode>): OrderedRow[] {
  const result: OrderedRow[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  function visit(anchor: string): void {
    if (visited.has(anchor)) return;

    if (visiting.has(anchor)) {
      // Cycle detected - just skip this edge
      return;
    }

    visiting.add(anchor);

    const node = graph.get(anchor);
    if (!node) return;

    // Visit parents first (composition)
    for (const parent of Array.from(node.parents)) {
      visit(parent);
    }

    // Visit dependencies first (prerequisites)
    for (const dep of Array.from(node.dependencies)) {
      visit(dep);
    }

    visiting.delete(anchor);
    visited.add(anchor);

    result.push({
      ...node.row,
      tableName: node.tableName,
    });
  }

  // Collect all nodes and sort by priority/time for deterministic ordering
  const anchors = Array.from(graph.keys()).sort((a, b) => {
    const nodeA = graph.get(a)!;
    const nodeB = graph.get(b)!;

    // Sort by priority first
    if (nodeA.priority !== nodeB.priority) {
      return nodeA.priority - nodeB.priority;
    }

    // Then by created time
    if (nodeA.createdUtc !== nodeB.createdUtc) {
      return nodeA.createdUtc - nodeB.createdUtc;
    }

    // Finally by anchor alphabetically
    return a.localeCompare(b);
  });

  // Visit all nodes
  for (const anchor of anchors) {
    visit(anchor);
  }

  return result;
}

/**
 * Order rows for export according to the specification.
 * Groups rows by table, maintaining topological order within each table.
 */
export function orderRows(
  dataTables: Table[],
  junctionTables: Table[],
  arrowMappings: Map<string, ArrowMapping>
): Map<string, Row[]> {
  const graph = buildRowGraph(dataTables, junctionTables, arrowMappings);
  const sortedRows = topologicalSort(graph);

  // Group by table
  const result = new Map<string, Row[]>();

  for (const orderedRow of sortedRows) {
    const { tableName, ...row } = orderedRow;

    if (!result.has(tableName)) {
      result.set(tableName, []);
    }

    result.get(tableName)!.push(row);
  }

  return result;
}
