import { describe, it, expect } from 'vitest';
import type { Database, Row, ColumnDefinition, TableSchema } from '@m2sql/model';
import { buildGraphFromDatabase, transformDatabaseToReactFlow, applyDagreLayout } from '@/lib/reactflow-transform';
import { computeEffectiveNodeDimensions, precomputeNodeDimensions } from '@/lib/data-driven-sizing';
import type { DataDrivenSizingConfig } from '@/stores/slices/uiSlice';
import type { Node, Edge } from 'reactflow';

/** Helper: build a minimal ColumnDefinition with sensible defaults */
function col(overrides: Partial<ColumnDefinition> & { name: string; type: ColumnDefinition['type'] }): ColumnDefinition {
  return {
    nullable: false,
    primaryKey: false,
    unique: false,
    defaultValue: null,
    ...overrides,
  };
}

/** Helper: build a minimal TableSchema */
function schema(columns: ColumnDefinition[]): TableSchema {
  return {
    name: '',
    columns,
    primaryKey: columns.filter(c => c.primaryKey).map(c => c.name),
    uniqueConstraints: [],
    checkConstraints: [],
  };
}

/** Helper: build a minimal Row */
function row(overrides: Partial<Row> & { name: string; anchor: string }): Row {
  return {
    columns: {},
    relationships: {},
    ...overrides,
  };
}

/** Helper: build a minimal Database */
function db(tables: Database['tables'], arrowMappings?: Database['arrowMappings']): Database {
  return {
    name: 'Test Database',
    anchor: 'test-database',
    tables,
    arrowMappings,
  };
}

describe('reactflow-transform', () => {
  describe('transformDatabaseToReactFlow', () => {
    it('should create nodes from data table rows', () => {
      const database = db([
        {
          name: 'tasks',
          schema: schema([
            col({ name: 'id', type: 'INTEGER', primaryKey: true }),
            col({ name: 'name', type: 'TEXT' }),
            col({ name: 'anchor', type: 'TEXT' }),
            col({ name: 'status', type: 'TEXT', nullable: true }),
          ]),
          rawSql: '',
          rows: [
            row({ pk: 1, name: 'Task 1', anchor: 'task-1', columns: { status: 'open' } }),
            row({ pk: 2, name: 'Task 2', anchor: 'task-2', columns: { status: 'closed' } }),
          ],
        },
      ]);

      const result = transformDatabaseToReactFlow(database);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toMatchObject({
        id: 'task-1',
        data: {
          label: 'Task 1',
          tableName: 'tasks',
          status: 'open',
        },
        type: 'task',
      });
      expect(result.nodes[1]).toMatchObject({
        id: 'task-2',
        data: {
          label: 'Task 2',
          tableName: 'tasks',
          status: 'closed',
        },
        type: 'task',
      });
    });

    it('should filter out internal columns starting with underscore', () => {
      const database = db([
        {
          name: 'tasks',
          schema: schema([
            col({ name: 'name', type: 'TEXT' }),
            col({ name: 'anchor', type: 'TEXT' }),
          ]),
          rawSql: '',
          rows: [
            row({
              pk: 1,
              name: 'Task 1',
              anchor: 'task-1',
              columns: { status: 'open', _internal: 'hidden' },
            }),
          ],
        },
      ]);

      const result = transformDatabaseToReactFlow(database);

      expect(result.nodes[0].data).toHaveProperty('status', 'open');
      expect(result.nodes[0].data).not.toHaveProperty('_internal');
    });

    it('should create edges from junction table rows', () => {
      const database = db([
        {
          name: 'tasks',
          schema: schema([
            col({ name: 'name', type: 'TEXT' }),
            col({ name: 'anchor', type: 'TEXT' }),
          ]),
          rawSql: '',
          rows: [
            row({ pk: 1, name: 'Task 1', anchor: 'task-1' }),
            row({ pk: 2, name: 'Task 2', anchor: 'task-2' }),
          ],
        },
        {
          name: 'tasks_dependencies',
          schema: schema([
            col({ name: '_lhs_anchor', type: 'TEXT' }),
            col({ name: '_rhs_anchor', type: 'TEXT' }),
          ]),
          rawSql: '',
          rows: [
            row({
              pk: 1,
              name: '',
              anchor: '',
              columns: {
                _lhs_anchor: 'task-1',
                _rhs_anchor: 'task-2',
                label: 'depends on',
              },
            }),
          ],
        },
      ]);

      const result = transformDatabaseToReactFlow(database);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({
        id: 'task-1-task-2',
        source: 'task-1',
        target: 'task-2',
        label: 'depends on',
        type: 'default',
      });
    });

    it('should handle arrow mappings for edge styling', () => {
      const database = db(
        [
          {
            name: 'tasks',
            schema: schema([
              col({ name: 'name', type: 'TEXT' }),
              col({ name: 'anchor', type: 'TEXT' }),
            ]),
            rawSql: '',
            rows: [
              row({ pk: 1, name: 'Task 1', anchor: 'task-1' }),
              row({ pk: 2, name: 'Task 2', anchor: 'task-2' }),
            ],
          },
          {
            name: 'tasks_dependencies',
            schema: schema([
              col({ name: '_lhs_anchor', type: 'TEXT' }),
              col({ name: '_rhs_anchor', type: 'TEXT' }),
            ]),
            rawSql: '',
            rows: [
              row({
                pk: 1,
                name: '',
                anchor: '',
                columns: {
                  _lhs_anchor: 'task-1',
                  _rhs_anchor: 'task-2',
                },
              }),
            ],
          },
        ],
        [
          {
            junctionTable: 'tasks_dependencies',
            arrowToken: '..>',
            leftColumn: 'dependent_task_id',
            rightColumn: 'prerequisite_task_id',
          },
        ],
      );

      const result = transformDatabaseToReactFlow(database);

      expect(result.edges[0]).toMatchObject({
        type: 'smoothstep',
        animated: true,
        label: '..>',
      });
    });

    it('should skip junction rows with missing anchors', () => {
      const database = db([
        {
          name: 'tasks',
          schema: schema([
            col({ name: 'name', type: 'TEXT' }),
            col({ name: 'anchor', type: 'TEXT' }),
          ]),
          rawSql: '',
          rows: [
            row({ pk: 1, name: 'Task 1', anchor: 'task-1' }),
          ],
        },
        {
          name: 'tasks_dependencies',
          schema: schema([
            col({ name: '_lhs_anchor', type: 'TEXT' }),
            col({ name: '_rhs_anchor', type: 'TEXT' }),
          ]),
          rawSql: '',
          rows: [
            row({
              pk: 1,
              name: '',
              anchor: '',
              columns: {
                _lhs_anchor: 'task-1',
                // Missing _rhs_anchor
              },
            }),
          ],
        },
      ]);

      const result = transformDatabaseToReactFlow(database);

      expect(result.edges).toHaveLength(0);
    });

    it('should return empty graph for empty database', () => {
      const database = db([]);

      const result = transformDatabaseToReactFlow(database);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('applyDagreLayout', () => {
    it('should position nodes using dagre layout', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          data: { label: 'Node 1' },
          type: 'default',
          position: { x: 0, y: 0 },
        },
        {
          id: 'node-2',
          data: { label: 'Node 2' },
          type: 'default',
          position: { x: 0, y: 0 },
        },
      ];

      const edges: Edge[] = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
        },
      ];

      const result = applyDagreLayout(nodes, edges);

      // Verify nodes have been repositioned (positions are defined)
      expect(result.nodes[0].position.x).toBeDefined();
      expect(result.nodes[0].position.y).toBeDefined();
      expect(result.nodes[1].position.x).toBeDefined();
      expect(result.nodes[1].position.y).toBeDefined();

      // Verify positions are numbers (dagre calculated them)
      expect(typeof result.nodes[0].position.x).toBe('number');
      expect(typeof result.nodes[0].position.y).toBe('number');

      // Verify edges are preserved
      expect(result.edges).toEqual(edges);
    });

    it('should handle single node without edges', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          data: { label: 'Node 1' },
          type: 'default',
          position: { x: 0, y: 0 },
        },
      ];

      const edges: Edge[] = [];

      const result = applyDagreLayout(nodes, edges);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
      // Single node should still get positioned
      expect(result.nodes[0].position.x).toBeDefined();
      expect(typeof result.nodes[0].position.x).toBe('number');
    });

    it('should handle empty graph', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      const result = applyDagreLayout(nodes, edges);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should position nodes in hierarchical order', () => {
      const nodes: Node[] = [
        {
          id: 'parent',
          data: { label: 'Parent' },
          type: 'default',
          position: { x: 0, y: 0 },
        },
        {
          id: 'child',
          data: { label: 'Child' },
          type: 'default',
          position: { x: 0, y: 0 },
        },
      ];

      const edges: Edge[] = [
        {
          id: 'edge-1',
          source: 'parent',
          target: 'child',
        },
      ];

      const result = applyDagreLayout(nodes, edges);

      // Parent should be above child (lower y value in TB layout)
      const parentNode = result.nodes.find(n => n.id === 'parent');
      const childNode = result.nodes.find(n => n.id === 'child');

      expect(parentNode!.position.y).toBeLessThan(childNode!.position.y);
    });

    it('should support LR rankdir (left-to-right)', () => {
      const nodes: Node[] = [
        { id: 'parent', data: { label: 'Parent' }, type: 'default', position: { x: 0, y: 0 } },
        { id: 'child', data: { label: 'Child' }, type: 'default', position: { x: 0, y: 0 } },
      ];
      const edges: Edge[] = [
        { id: 'edge-1', source: 'parent', target: 'child' },
      ];

      const result = applyDagreLayout(nodes, edges, { rankdir: 'LR', nodesep: 100, ranksep: 100 });
      const parentNode = result.nodes.find(n => n.id === 'parent')!;
      const childNode = result.nodes.find(n => n.id === 'child')!;

      // In LR layout, parent should be to the left of child
      expect(parentNode.position.x).toBeLessThan(childNode.position.x);
    });

    it('should respect custom nodesep and ranksep', () => {
      const nodes: Node[] = [
        { id: 'a', data: { label: 'A' }, type: 'default', position: { x: 0, y: 0 } },
        { id: 'b', data: { label: 'B' }, type: 'default', position: { x: 0, y: 0 } },
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b' },
      ];

      const narrow = applyDagreLayout(nodes, edges, { rankdir: 'TB', nodesep: 20, ranksep: 20 });
      const wide = applyDagreLayout(nodes, edges, { rankdir: 'TB', nodesep: 400, ranksep: 400 });

      const narrowGap = Math.abs(
        narrow.nodes.find(n => n.id === 'b')!.position.y - narrow.nodes.find(n => n.id === 'a')!.position.y
      );
      const wideGap = Math.abs(
        wide.nodes.find(n => n.id === 'b')!.position.y - wide.nodes.find(n => n.id === 'a')!.position.y
      );

      expect(wideGap).toBeGreaterThan(narrowGap);
    });

    it('should use node.width and node.height when set', () => {
      const nodes: Node[] = [
        { id: 'big', data: { label: 'Big' }, type: 'default', position: { x: 0, y: 0 }, width: 400, height: 200 },
        { id: 'small', data: { label: 'Small' }, type: 'default', position: { x: 0, y: 0 }, width: 100, height: 50 },
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'big', target: 'small' },
      ];

      // Should not throw and should produce valid positions
      const result = applyDagreLayout(nodes, edges);
      expect(result.nodes).toHaveLength(2);
      expect(typeof result.nodes[0].position.x).toBe('number');
      expect(typeof result.nodes[1].position.x).toBe('number');
    });
  });

  /**
   * Pipeline integration: data-driven sizing → layout.
   *
   * The correct pipeline is:
   *   1. initialize_raw_graph  (buildGraphFromDatabase)
   *   2. compute_node_sizes    (computeEffectiveNodeDimensions)
   *   3. layout_with_sizes     (applyDagreLayout with pre-computed dimensions)
   *
   * BUG: When step 2 is skipped (dagre receives raw nodes without
   * width/height), all nodes default to 200×100 regardless of their
   * data-driven size. Dagre spaces them for 200px widths, but actual
   * rendered widths can be much larger → nodes overlap visually.
   */
  describe('data-driven sizing + layout pipeline', () => {
    // Shared test data: 3 sibling nodes with very different durations
    const taskDatabase = db([
      {
        name: 'tasks',
        schema: schema([
          col({ name: 'id', type: 'INTEGER', primaryKey: true }),
          col({ name: 'name', type: 'TEXT' }),
          col({ name: 'anchor', type: 'TEXT' }),
          col({ name: 'duration', type: 'INTEGER', nullable: true }),
        ]),
        rawSql: '',
        rows: [
          row({ pk: 1, name: 'Long Task', anchor: 'task-long', columns: { duration: 100 } }),
          row({ pk: 2, name: 'Medium Task', anchor: 'task-med', columns: { duration: 60 } }),
          row({ pk: 3, name: 'Short Task', anchor: 'task-short', columns: { duration: 20 } }),
        ],
      },
    ]);

    const ddSizingConfig: DataDrivenSizingConfig = {
      enabled: true,
      column: 'duration',
      axis: 'width',
      scaleFactor: 5,
      minSize: 80,
    };

    /** Check whether two axis-aligned rectangles overlap. */
    function rectsOverlap(
      ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number,
    ): boolean {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    it('should not produce overlapping nodes when data-driven sizes are applied before layout', () => {
      // Step 1: build raw graph (no dimensions)
      const { nodes: rawNodes, edges } = buildGraphFromDatabase(taskDatabase);

      // Step 2: compute actual data-driven dimensions
      const actualDims = rawNodes.map(n =>
        computeEffectiveNodeDimensions(n.data, {
          dataDrivenSizing: ddSizingConfig,
          fixHeight: true,
        })
      );
      // Sanity: widths should be 500, 300, 100
      expect(actualDims.map(d => d.width)).toEqual([500, 300, 100]);

      // Step 2b: apply computed dimensions to nodes BEFORE layout
      const sizedNodes = rawNodes.map((n, i) => ({
        ...n,
        width: actualDims[i].width,
        height: actualDims[i].height,
      }));

      // Step 3: layout with correct dimensions
      const { nodes: laidOut } = applyDagreLayout(sizedNodes, edges, {
        rankdir: 'TB',
        nodesep: 20,
        ranksep: 100,
      });

      // Assert: no pair of nodes overlaps at their actual rendered sizes
      for (let i = 0; i < laidOut.length; i++) {
        for (let j = i + 1; j < laidOut.length; j++) {
          const a = laidOut[i];
          const b = laidOut[j];
          const overlap = rectsOverlap(
            a.position.x, a.position.y, actualDims[i].width, actualDims[i].height,
            b.position.x, b.position.y, actualDims[j].width, actualDims[j].height,
          );
          expect(overlap, `nodes ${a.id} and ${b.id} overlap`).toBe(false);
        }
      }
    });

    /**
     * Regression test for the overlap bug.
     *
     * Without precomputeNodeDimensions, dagre receives raw nodes (no
     * width/height), defaults to 200×100, and spaces them for 200px —
     * but actual data-driven widths are 500, 300, 100, causing overlap.
     *
     * The fix: use precomputeNodeDimensions before layout so dagre knows
     * the actual sizes.
     */
    it('should not produce overlapping nodes when precomputeNodeDimensions is used', () => {
      // Step 1: build raw graph (no dimensions — width/height undefined)
      const { nodes: rawNodes, edges } = buildGraphFromDatabase(taskDatabase);

      // Step 2: pre-compute data-driven dimensions (the FIX)
      const sizedNodes = precomputeNodeDimensions(rawNodes, {
        dataDrivenSizing: ddSizingConfig,
        fixHeight: true,
      });

      // Step 3: layout with pre-computed dimensions
      const { nodes: laidOut } = applyDagreLayout(sizedNodes, edges, {
        rankdir: 'TB',
        nodesep: 20,
        ranksep: 100,
      });

      // Compute actual rendered sizes for overlap check
      const actualDims = rawNodes.map(n =>
        computeEffectiveNodeDimensions(n.data, {
          dataDrivenSizing: ddSizingConfig,
          fixHeight: true,
        })
      );

      // Assert: no overlap at actual rendered sizes
      for (let i = 0; i < laidOut.length; i++) {
        for (let j = i + 1; j < laidOut.length; j++) {
          const a = laidOut[i];
          const b = laidOut[j];
          const overlap = rectsOverlap(
            a.position.x, a.position.y, actualDims[i].width, actualDims[i].height,
            b.position.x, b.position.y, actualDims[j].width, actualDims[j].height,
          );
          expect(overlap, `nodes ${a.id} and ${b.id} overlap`).toBe(false);
        }
      }
    });
  });
});
