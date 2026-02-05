/**
 * Integration tests for the Mermaid classDiagram parser.
 * Tests the complete pipeline from file parsing to validation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMermaid } from './mermaid-parse.js';
import { validateModel } from './validate.js';

describe('mermaid integration', () => {
  test('parses and validates project-planner.mmd example', () => {
    // Read example file
    const examplePath = join(process.cwd(), '..', '..', 'examples', 'project-planner.mmd');
    const content = readFileSync(examplePath, 'utf-8');

    // Parse
    const parseResult = parseMermaid(content);

    // Verify parse succeeded
    assert.strictEqual(parseResult.databases.length, 1, 'Should have 1 database');
    assert.strictEqual(parseResult.errors.length, 0, 'Should have no parse errors');

    const db = parseResult.databases[0];
    assert.strictEqual(db?.name, 'Piste Perfect Project Planner');

    // Verify tables (should have data table + 2 junction tables)
    assert.strictEqual(db?.tables.length, 3, 'Should have 3 tables (1 data + 2 junction)');

    const taskTable = db?.tables.find(t => t.name === 'task');
    const partOfTable = db?.tables.find(t => t.name === 'task_part_of');
    const dependsOnTable = db?.tables.find(t => t.name === 'task_depends_on');

    assert.ok(taskTable, 'Should have task table');
    assert.ok(partOfTable, 'Should have task_part_of junction table');
    assert.ok(dependsOnTable, 'Should have task_depends_on junction table');

    // Verify rows in task table
    assert.ok(taskTable && taskTable.rows.length > 0, 'Should have rows in task table');

    // Verify task table schema
    assert.ok(taskTable?.schema.columns.length === 2, 'Task table should have 2 columns');
    const schemaColNames = taskTable?.schema.columns.map(c => c.name);
    assert.ok(schemaColNames?.includes('task_type'));
    assert.ok(schemaColNames?.includes('hours_estimate'));

    // Verify relationships exist in junction tables (not in row.relationships)
    const partOfRelationships = partOfTable?.rows.length || 0;
    const dependsOnRelationships = dependsOnTable?.rows.length || 0;
    assert.ok(partOfRelationships > 0, 'Should have part_of relationships in junction table');
    assert.ok(dependsOnRelationships > 0, 'Should have depends_on relationships in junction table');

    // Validate model
    const validationResult = validateModel(parseResult.databases);
    if (!validationResult.valid) {
      console.log('Validation errors:');
      for (const error of validationResult.errors) {
        console.log(`  - [${error.type}] ${error.message}`);
      }
    }
    assert.strictEqual(validationResult.valid, true, 'Model should be valid');
    assert.strictEqual(validationResult.errors.length, 0, 'Should have no validation errors');
  });

  test('validates anchor uniqueness', () => {
    const content = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}
`;

    const result = parseMermaid(content);
    const validation = validateModel(result.databases);

    assert.strictEqual(validation.valid, true);

    // Verify anchors are unique
    const anchors = new Set<string>();
    for (const table of result.databases[0]?.tables || []) {
      for (const row of table.rows) {
        assert.strictEqual(anchors.has(row.anchor), false, `Duplicate anchor: ${row.anchor}`);
        anchors.add(row.anchor);
      }
    }
  });

  test('validates relationships reference existing anchors', () => {
    const content = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
%% CREATE TABLE task_part_of (
%%   parent_task_id INTEGER REFERENCES task(id),
%%   child_task_id INTEGER REFERENCES task(id),
%%   PRIMARY KEY (parent_task_id, child_task_id)
%% );
%% parent_task_id *-- child_task_id : task_part_of
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}

A *-- NonExistent
`;

    const result = parseMermaid(content);

    // Should have parse errors for unresolved anchor
    assert.ok(result.errors.some(e => e.message.includes('Unresolved anchor: NonExistent')));
  });

  test('detects cycles in hierarchical relationships', () => {
    const content = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
%% CREATE TABLE task_part_of (
%%   parent_task_id INTEGER REFERENCES task(id),
%%   child_task_id INTEGER REFERENCES task(id),
%%   PRIMARY KEY (parent_task_id, child_task_id)
%% );
%% parent_task_id *-- child_task_id : task_part_of
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
    class C:::task{name: Task C}
}

A *-- B
B *-- C
C *-- A
`;

    const result = parseMermaid(content);
    const validation = validateModel(result.databases);

    assert.strictEqual(validation.valid, false);
    assert.ok(
      validation.errors.some(e => e.type === 'cycle_detected' && e.message.includes('hierarchical')),
      'Should detect cycle in part_of relationships'
    );
  });

  test('detects cycles in dependency relationships', () => {
    const content = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
%% CREATE TABLE task_depends_on (
%%   dependent_task_id INTEGER REFERENCES task(id),
%%   prerequisite_task_id INTEGER REFERENCES task(id),
%%   PRIMARY KEY (dependent_task_id, prerequisite_task_id)
%% );
%% dependent_task_id ..> prerequisite_task_id : task_depends_on
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}

A ..> B
B ..> A
`;

    const result = parseMermaid(content);
    const validation = validateModel(result.databases);

    assert.strictEqual(validation.valid, false);
    assert.ok(
      validation.errors.some(e => e.type === 'cycle_detected' && e.message.includes('dependency')),
      'Should detect cycle in depends_on relationships'
    );
  });
});
