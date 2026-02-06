/**
 * Diagnostic test to verify full pipeline with logging at each stage.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { parseMermaid } from '@m2sql/parser';
import { compileToSqlite, extractFromDb } from '@m2sql/sqlite';
import { renderToMermaid } from './render.js';

test('pipeline-debug - verify metadata flow', async () => {
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

  console.log('\n========== STAGE 1: PARSER ==========');
  const parseResult = parseMermaid(mermaid);
  assert.strictEqual(parseResult.errors.length, 0, 'Parsing should succeed');

  const database = parseResult.databases[0]!;
  console.log('Database name:', database.name);
  console.log('Arrow mappings:', JSON.stringify(database.arrowMappings, null, 2));
  console.log('Number of tables:', database.tables.length);

  assert.ok(database.arrowMappings, 'Should have arrowMappings array');
  assert.strictEqual(database.arrowMappings!.length, 1, 'Should have 1 arrow mapping');
  console.log('✓ Parser populated arrowMappings');

  console.log('\n========== STAGE 2: COMPILER ==========');
  const db = await compileToSqlite([database]);

  // Check if metadata table exists
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tables in DB:', tables[0]?.values.map(row => row[0]));

  // Check metadata table contents
  try {
    const metadata = db.exec('SELECT * FROM _mermaid_arrow_mappings');
    console.log('Metadata table exists:', metadata.length > 0);
    if (metadata.length > 0) {
      console.log('Metadata columns:', metadata[0]!.columns);
      console.log('Metadata rows:', metadata[0]!.values);
      assert.strictEqual(metadata[0]!.values.length, 1, 'Should have 1 metadata row');
      console.log('✓ Compiler wrote metadata');
    } else {
      console.log('❌ Metadata table empty!');
    }
  } catch (e) {
    console.log('❌ Metadata table does not exist!', (e as Error).message);
  }

  // Check junction table
  const junctionData = db.exec('SELECT * FROM task_part_of');
  console.log('Junction table rows:', junctionData[0]?.values.length || 0);

  console.log('\n========== STAGE 3: EXTRACT ==========');
  const extracted = extractFromDb(db, database.name);
  console.log('Extracted tables:', extracted.tables.length);
  console.log('Extracted arrowMappings:', JSON.stringify(extracted.arrowMappings, null, 2));

  assert.ok(extracted.arrowMappings, 'Extracted database should have arrowMappings');
  assert.strictEqual(extracted.arrowMappings!.length, 1, 'Should have 1 arrow mapping');
  console.log('✓ Extract read metadata');

  // Check junction table in extracted data
  const extractedJunction = extracted.tables.find(t => t.name === 'task_part_of');
  console.log('Extracted junction rows:', extractedJunction?.rows.length || 0);
  if (extractedJunction && extractedJunction.rows.length > 0) {
    console.log('First junction row:', extractedJunction.rows[0]);
  }

  console.log('\n========== STAGE 4: RENDERER ==========');
  const result = renderToMermaid(extracted);
  console.log('Render warnings:', result.warnings.length);
  result.warnings.forEach(w => console.log('  Warning:', w.message));

  const rendered = result.mermaid;

  // Find arrow lines
  const arrowLines = rendered
    .split('\n')
    .filter(line => /^\w+ [.*<>|-]+ \w+/.test(line));

  console.log('Arrow lines found:', arrowLines.length);
  arrowLines.forEach(line => console.log('  Arrow:', line));

  // Print full rendered output for inspection
  console.log('\n========== RENDERED OUTPUT ==========');
  console.log(rendered);
  console.log('=====================================\n');

  assert.strictEqual(result.warnings.length, 0, 'Should have no warnings');
  assert.ok(arrowLines.length > 0, 'Should have at least one arrow line');
  assert.ok(rendered.includes('A *-- B'), 'Should have arrow declaration');

  console.log('✓ Full pipeline test passed!');
});
