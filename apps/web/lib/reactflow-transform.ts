/**
 * Transform Database model to ReactFlow graph representation.
 * Converts tables and rows into nodes and edges for visualization.
 */

import type { Database, Table } from '@m2sql/model';
import { isJunctionTableByRows } from '@m2sql/model';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';

export interface ReactFlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Build the raw graph (nodes + edges) without layout.
 * Useful when you need the data before applying layout with custom edge filtering.
 */
export function buildGraphFromDatabase(database: Database): ReactFlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Step 1: Separate data tables and junction tables
  const dataTables = database.tables.filter(t => !isJunctionTableByRows(t.rows));
  const junctionTables = database.tables.filter(t => isJunctionTableByRows(t.rows));

  // Step 2: Create nodes from data table rows
  for (const table of dataTables) {
    for (const row of table.rows) {
      // Extract display properties
      const displayColumns: Record<string, any> = {};
      for (const [key, value] of Object.entries(row.columns)) {
        if (!key.startsWith('_') && key !== 'id') {
          displayColumns[key] = value;
        }
      }

      nodes.push({
        id: row.anchor,
        data: {
          label: row.name,
          name: row.name,  // Include name for filtering
          tableName: table.name,
          ...displayColumns,
        },
        type: 'task',
        position: { x: 0, y: 0 }, // Will be positioned by layout
      });
    }
  }

  // Step 3: Create edges from junction table rows
  for (const junctionTable of junctionTables) {
    // Find arrow mapping for this junction table
    const arrowMapping = database.arrowMappings?.find(
      m => m.junctionTable === junctionTable.name
    );

    for (const row of junctionTable.rows) {
      const lhsAnchor = row.columns['_lhs_anchor'] as string | undefined;
      const rhsAnchor = row.columns['_rhs_anchor'] as string | undefined;

      if (!lhsAnchor || !rhsAnchor) continue;

      const label = row.columns['label'] as string | undefined;
      const arrowToken = arrowMapping?.arrowToken || '-->';

      // Determine edge type based on arrow token
      const type = arrowToken.includes('..') ? 'smoothstep' : 'default';

      edges.push({
        id: `${lhsAnchor}-${rhsAnchor}`,
        source: lhsAnchor,
        target: rhsAnchor,
        label: label || arrowToken,
        type,
        animated: arrowToken.includes('..'), // Animate dependency arrows
        data: { junctionTable: junctionTable.name },
      });
    }
  }

  return { nodes, edges };
}

/**
 * Transform Database model to ReactFlow nodes and edges with layout applied.
 * Data tables become nodes, junction tables become edges.
 */
export function transformDatabaseToReactFlow(database: Database): ReactFlowGraph {
  const { nodes, edges } = buildGraphFromDatabase(database);
  return applyDagreLayout(nodes, edges);
}

/**
 * Apply dagre automatic layout algorithm to position nodes.
 * Creates a hierarchical top-to-bottom layout.
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[]
): ReactFlowGraph {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB', // Top-to-bottom
    nodesep: 100,
    ranksep: 100,
  });

  // Add nodes to dagre graph
  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: 200, height: 100 });
  });

  // Add edges to dagre graph
  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Update node positions from dagre
  const layoutedNodes = nodes.map(node => {
    const position = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - 100, // Center the node
        y: position.y - 50,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
}
