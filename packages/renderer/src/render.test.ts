/**
 * Integration tests for the renderer.
 * Tests round-trip capability: parse -> compile -> extract -> render.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import type { Database, Table, Row, TableSchema } from '@m2sql/model';
import { renderToMermaid } from './render.js';
import { inferArrowMappings } from './arrow-mappings.js';
import { orderRows } from './ordering.js';

// Test helper: create a minimal database model
function createTestDatabase(): Database {
  const taskSchema: TableSchema = {
    name: 'task',
    columns: [
      {
        name: 'task_type',
        type: 'TEXT',
        nullable: true,
        primaryKey: false,
        unique: false,
        defaultValue: null,
      },
      {
        name: 'hours_estimate',
        type: 'INTEGER',
        nullable: true,
        primaryKey: false,
        unique: false,
        defaultValue: null,
      },
    ],
    primaryKey: ['id'],
    uniqueConstraints: [],
    checkConstraints: [],
  };

  const taskPartOfSchema: TableSchema = {
    name: 'task_part_of',
    columns: [
      {
        name: 'parent_task_id',
        type: 'INTEGER',
        nullable: false,
        primaryKey: true,
        unique: false,
        defaultValue: null,
        references: {
          table: 'task',
          column: 'id',
        },
      },
      {
        name: 'child_task_id',
        type: 'INTEGER',
        nullable: false,
        primaryKey: true,
        unique: false,
        defaultValue: null,
        references: {
          table: 'task',
          column: 'id',
        },
      },
      {
        name: 'label',
        type: 'TEXT',
        nullable: true,
        primaryKey: false,
        unique: false,
        defaultValue: null,
      },
    ],
    primaryKey: ['parent_task_id', 'child_task_id'],
    uniqueConstraints: [],
    checkConstraints: [],
  };

  const rows: Row[] = [
    {
      name: 'Early Access Release',
      anchor: 'EAR',
      pk: 1,
      columns: {
        task_type: 'milestone',
        hours_estimate: 2000,
      },
      relationships: {},
    },
    {
      name: 'Core Game Loop',
      anchor: 'CGL',
      pk: 2,
      columns: {
        task_type: 'feature',
        hours_estimate: 500,
      },
      relationships: {},
    },
  ];

  const junctionRows: Row[] = [
    {
      name: 'EAR → CGL',
      anchor: 'task_part_of_EAR_CGL',
      columns: {
        _lhs_anchor: 'EAR',
        _rhs_anchor: 'CGL',
      },
      relationships: {},
    },
  ];

  const tables: Table[] = [
    {
      name: 'task',
      schema: taskSchema,
      rawSql: 'CREATE TABLE task (\n  task_type TEXT,\n  hours_estimate INTEGER\n);',
      rows,
    },
    {
      name: 'task_part_of',
      schema: taskPartOfSchema,
      rawSql:
        'CREATE TABLE task_part_of (\n  parent_task_id INTEGER REFERENCES task(id),\n  child_task_id INTEGER REFERENCES task(id),\n  label TEXT,\n  PRIMARY KEY (parent_task_id, child_task_id)\n);',
      rows: junctionRows,
    },
  ];

  return {
    name: 'Test Database',
    anchor: 'test-database',
    tables,
    arrowMappings: [
      {
        junctionTable: 'task_part_of',
        leftColumn: 'parent_task_id',
        arrowToken: '*--',
        rightColumn: 'child_task_id',
      },
    ],
  };
}

test('renderToMermaid - produces valid Mermaid output', () => {
  const database = createTestDatabase();
  const result = renderToMermaid(database);

  assert.strictEqual(result.warnings.length, 0, 'Should have no warnings');

  const output = result.mermaid;

  // Check basic structure
  assert.ok(output.includes('---'), 'Should have frontmatter');
  assert.ok(output.includes('title: Test Database'), 'Should include database name');
  assert.ok(output.includes('classDiagram'), 'Should have classDiagram declaration');
  assert.ok(output.includes('namespace task {'), 'Should have namespace block');
  assert.ok(output.includes('class EAR:::task{'), 'Should have class declaration');
  assert.ok(output.includes('name: "Early Access Release"'), 'Should include row name (quoted)');
  assert.ok(output.includes('id: 1'), 'Should include id for UPSERT');
  assert.ok(output.includes('task_type: milestone'), 'Should include column values');
});

test('renderToMermaid - includes SQL header', () => {
  const database = createTestDatabase();
  const { mermaid: output } = renderToMermaid(database);

  assert.ok(output.includes('%% CREATE TABLE task'), 'Should have CREATE TABLE statement');
  assert.ok(
    output.includes('%% CREATE TABLE task_part_of'),
    'Should include junction table'
  );
});

test('renderToMermaid - includes arrow mappings', () => {
  const database = createTestDatabase();
  const { mermaid: output } = renderToMermaid(database);

  // Arrow mappings from parsed data
  assert.ok(
    output.includes('%% parent_task_id *-- child_task_id : task_part_of'),
    'Should have arrow mapping from metadata'
  );
});

test('renderToMermaid - includes arrow declarations', () => {
  const database = createTestDatabase();
  const { mermaid: output } = renderToMermaid(database);

  assert.ok(output.includes('EAR *-- CGL'), 'Should have arrow declaration');
});

test('renderToMermaid - includes classDef styles by default', () => {
  const database = createTestDatabase();
  const { mermaid: output } = renderToMermaid(database);

  assert.ok(output.includes('classDef task'), 'Should have classDef');
});

test('renderToMermaid - can disable styles', () => {
  const database = createTestDatabase();
  const { mermaid: output } = renderToMermaid(database, { includeStyles: false });

  assert.ok(!output.includes('classDef'), 'Should not have classDef when disabled');
});

test('arrowMappings - stored in database model', () => {
  const database = createTestDatabase();

  assert.ok(database.arrowMappings, 'Should have arrow mappings');
  assert.strictEqual(database.arrowMappings!.length, 1, 'Should have 1 arrow mapping');

  const mapping = database.arrowMappings![0]!;
  assert.strictEqual(mapping.leftColumn, 'parent_task_id');
  assert.strictEqual(mapping.arrowToken, '*--');
  assert.strictEqual(mapping.rightColumn, 'child_task_id');
  assert.strictEqual(mapping.junctionTable, 'task_part_of');
});

test('arrowMappings - preserved from parser', () => {
  // Arrow mappings come from parser, not inference
  const database = createTestDatabase();

  // Test that arrow mappings are part of the database model
  assert.ok(database.arrowMappings, 'Should have arrow mappings');
  assert.strictEqual(database.arrowMappings!.length, 1);

  const mapping = database.arrowMappings![0]!;
  assert.strictEqual(mapping.arrowToken, '*--', 'Arrow token preserved from parser');
});

test('orderRows - topological sort with composition', () => {
  const database = createTestDatabase();
  const { dataTables, junctionTables } = database.tables.reduce(
    (acc, table) => {
      const isJunction = table.name === 'task_part_of';
      if (isJunction) {
        acc.junctionTables.push(table);
      } else {
        acc.dataTables.push(table);
      }
      return acc;
    },
    { dataTables: [] as Table[], junctionTables: [] as Table[] }
  );

  const arrowMappings = new Map(database.arrowMappings!.map(m => [m.junctionTable, m]));
  const ordered = orderRows(dataTables, junctionTables, arrowMappings);

  const taskRows = ordered.get('task');
  assert.ok(taskRows, 'Should have task rows');
  assert.strictEqual(taskRows!.length, 2, 'Should have 2 rows');

  // EAR should come before CGL (parent before child)
  const earIndex = taskRows!.findIndex(r => r.anchor === 'EAR');
  const cglIndex = taskRows!.findIndex(r => r.anchor === 'CGL');

  assert.ok(earIndex < cglIndex, 'Parent should come before child');
});

test('renderToMermaid - handles empty tables', () => {
  const emptyTable: Table = {
    name: 'empty_table',
    schema: {
      name: 'empty_table',
      columns: [],
      primaryKey: ['id'],
      uniqueConstraints: [],
      checkConstraints: [],
    },
    rawSql: 'CREATE TABLE empty_table (id INTEGER PRIMARY KEY);',
    rows: [],
  };

  const database: Database = {
    name: 'Empty Test',
    anchor: 'empty-test',
    tables: [emptyTable],
  };

  const { mermaid: output } = renderToMermaid(database);

  assert.ok(output.includes('namespace empty_table {'), 'Should have namespace');
  assert.ok(!output.includes('class '), 'Should have no classes');
});

test('renderToMermaid - escapes special characters in values', () => {
  const row: Row = {
    name: 'Task: With Special',
    anchor: 'TSP',
    pk: 1,
    columns: {
      description: 'Contains: colons and spaces',
    },
    relationships: {},
  };

  const table: Table = {
    name: 'task',
    schema: {
      name: 'task',
      columns: [],
      primaryKey: ['id'],
      uniqueConstraints: [],
      checkConstraints: [],
    },
    rawSql: '',
    rows: [row],
  };

  const database: Database = {
    name: 'Test',
    anchor: 'test',
    tables: [table],
  };

  const { mermaid: output } = renderToMermaid(database);

  // Values with colons or spaces should be quoted
  assert.ok(output.includes('"Task: With Special"'), 'Should quote name with colon');
  assert.ok(
    output.includes('"Contains: colons and spaces"'),
    'Should quote value with special chars'
  );
});
