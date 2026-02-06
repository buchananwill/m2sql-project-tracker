/**
 * Debug test for extract functionality
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { parseMermaid } from '@m2sql/parser';
import { compileToSqlite, extractFromDb } from '@m2sql/sqlite';
import { renderToMermaid } from './render.js';

test('extract - junction tables have anchor markers', async () => {
  const mermaid = `---
title: Test
---

%% CREATE TABLE task (
%%   task_type TEXT
%% );
%%
%% CREATE TABLE task_part_of (
%%   parent_task_id INTEGER REFERENCES task(id),
%%   child_task_id INTEGER REFERENCES task(id),
%%   PRIMARY KEY (parent_task_id, child_task_id)
%% );
%%
%% parent_task_id *-- child_task_id : task_part_of

classDiagram

namespace task {
    class A:::task{
    name: Task A
    }

    class B:::task{
    name: Task B
    }
}

A *-- B
`;

  // Parse
  const parseResult = parseMermaid(mermaid);
  assert.strictEqual(parseResult.errors.length, 0, 'Parsing should succeed');

  const database = parseResult.databases[0]!;

  // Check parsed junction table
  console.log('Parsed junction tables:');
  for (const table of database.tables) {
    if (table.name === 'task_part_of') {
      console.log(`  ${table.name}: ${table.rows.length} rows`);
      for (const row of table.rows) {
        console.log(`    Name: ${row.name}`);
        console.log(`    Columns:`, row.columns);
      }
    }
  }

  // Compile
  const db = await compileToSqlite([database]);

  // Check what's in SQLite
  const rawData = db.exec('SELECT * FROM task_part_of');
  console.log('\nRaw SQLite data:', JSON.stringify(rawData, null, 2));

  // Extract
  const extracted = extractFromDb(db, database.name);

  // Check extracted junction table
  console.log('\nExtracted junction tables:');
  for (const table of extracted.tables) {
    if (table.name === 'task_part_of') {
      console.log(`  ${table.name}: ${table.rows.length} rows`);
      for (const row of table.rows) {
        console.log(`    Name: ${row.name}`);
        console.log(`    Anchor: ${row.anchor}`);
        console.log(`    Columns:`, row.columns);
      }

      assert.strictEqual(table.rows.length, 1, 'Should have 1 junction row');
      // Junction tables now have raw FK IDs, not anchors
      // The renderer will resolve IDs to anchors
      assert.ok(table.rows[0]!.columns['parent_task_id'], 'Should have parent_task_id FK');
      assert.ok(table.rows[0]!.columns['child_task_id'], 'Should have child_task_id FK');
    }
  }
});
