import { describe, it, expect } from 'vitest';
import type { Database } from '@m2sql/model';
import { transformDatabaseToReactFlow, applyDagreLayout } from '@/lib/reactflow-transform';
import type { Node, Edge } from 'reactflow';

describe('reactflow-transform', () => {
  describe('transformDatabaseToReactFlow', () => {
    it('should create nodes from data table rows', () => {
      const database: Database = {
        tables: [
          {
            name: 'tasks',
            schema: {
              columns: [
                { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
                { name: 'name', type: 'TEXT', nullable: false },
                { name: 'anchor', type: 'TEXT', nullable: false },
                { name: 'status', type: 'TEXT', nullable: true },
              ],
            },
            rows: [
              {
                pk: 1,
                name: 'Task 1',
                anchor: 'task-1',
                columns: { status: 'open' },
              },
              {
                pk: 2,
                name: 'Task 2',
                anchor: 'task-2',
                columns: { status: 'closed' },
              },
            ],
          },
        ],
      };

      const result = transformDatabaseToReactFlow(database);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toMatchObject({
        id: 'task-1',
        data: {
          label: 'Task 1',
          tableName: 'tasks',
          status: 'open',
        },
        type: 'default',
      });
      expect(result.nodes[1]).toMatchObject({
        id: 'task-2',
        data: {
          label: 'Task 2',
          tableName: 'tasks',
          status: 'closed',
        },
        type: 'default',
      });
    });

    it('should filter out internal columns starting with underscore', () => {
      const database: Database = {
        tables: [
          {
            name: 'tasks',
            schema: {
              columns: [
                { name: 'name', type: 'TEXT', nullable: false },
                { name: 'anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              {
                pk: 1,
                name: 'Task 1',
                anchor: 'task-1',
                columns: {
                  status: 'open',
                  _internal: 'hidden',
                },
              },
            ],
          },
        ],
      };

      const result = transformDatabaseToReactFlow(database);

      expect(result.nodes[0].data).toHaveProperty('status', 'open');
      expect(result.nodes[0].data).not.toHaveProperty('_internal');
    });

    it('should create edges from junction table rows', () => {
      const database: Database = {
        tables: [
          {
            name: 'tasks',
            schema: {
              columns: [
                { name: 'name', type: 'TEXT', nullable: false },
                { name: 'anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              { pk: 1, name: 'Task 1', anchor: 'task-1', columns: {} },
              { pk: 2, name: 'Task 2', anchor: 'task-2', columns: {} },
            ],
          },
          {
            name: 'tasks_dependencies',
            schema: {
              columns: [
                { name: '_lhs_anchor', type: 'TEXT', nullable: false },
                { name: '_rhs_anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              {
                pk: 1,
                name: '',
                anchor: '',
                columns: {
                  _lhs_anchor: 'task-1',
                  _rhs_anchor: 'task-2',
                  label: 'depends on',
                },
              },
            ],
          },
        ],
      };

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
      const database: Database = {
        tables: [
          {
            name: 'tasks',
            schema: {
              columns: [
                { name: 'name', type: 'TEXT', nullable: false },
                { name: 'anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              { pk: 1, name: 'Task 1', anchor: 'task-1', columns: {} },
              { pk: 2, name: 'Task 2', anchor: 'task-2', columns: {} },
            ],
          },
          {
            name: 'tasks_dependencies',
            schema: {
              columns: [
                { name: '_lhs_anchor', type: 'TEXT', nullable: false },
                { name: '_rhs_anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              {
                pk: 1,
                name: '',
                anchor: '',
                columns: {
                  _lhs_anchor: 'task-1',
                  _rhs_anchor: 'task-2',
                },
              },
            ],
          },
        ],
        arrowMappings: [
          {
            junctionTable: 'tasks_dependencies',
            arrowToken: '..>',
            lhsTable: 'tasks',
            rhsTable: 'tasks',
          },
        ],
      };

      const result = transformDatabaseToReactFlow(database);

      expect(result.edges[0]).toMatchObject({
        type: 'smoothstep',
        animated: true,
        label: '..>',
      });
    });

    it('should skip junction rows with missing anchors', () => {
      const database: Database = {
        tables: [
          {
            name: 'tasks',
            schema: {
              columns: [
                { name: 'name', type: 'TEXT', nullable: false },
                { name: 'anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              { pk: 1, name: 'Task 1', anchor: 'task-1', columns: {} },
            ],
          },
          {
            name: 'tasks_dependencies',
            schema: {
              columns: [
                { name: '_lhs_anchor', type: 'TEXT', nullable: false },
                { name: '_rhs_anchor', type: 'TEXT', nullable: false },
              ],
            },
            rows: [
              {
                pk: 1,
                name: '',
                anchor: '',
                columns: {
                  _lhs_anchor: 'task-1',
                  // Missing _rhs_anchor
                },
              },
            ],
          },
        ],
      };

      const result = transformDatabaseToReactFlow(database);

      expect(result.edges).toHaveLength(0);
    });

    it('should return empty graph for empty database', () => {
      const database: Database = {
        tables: [],
      };

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
});
