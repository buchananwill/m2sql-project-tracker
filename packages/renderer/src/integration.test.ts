/**
 * Integration test: full round-trip from Mermaid to SQLite and back.
 * Tests: Parse → Compile → Extract → Render
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseMermaid } from '@m2sql/parser';
import { compileToSqlite, extractFromDb } from '@m2sql/sqlite';
import { renderToMermaid } from './render.js';

test('integration - round-trip with example file', async () => {
  // Read the example Mermaid file
  const examplePath = join(process.cwd(), '..', '..', 'examples', 'project-planner.mmd');
  const mermaidContent = await readFile(examplePath, 'utf-8');

  // Parse
  const parseResult = parseMermaid(mermaidContent);
  assert.strictEqual(parseResult.errors.length, 0, 'Parsing should succeed');
  assert.strictEqual(parseResult.databases.length, 1, 'Should have 1 database');

  const database = parseResult.databases[0]!;

  // Compile to SQLite
  const db = await compileToSqlite([database]);

  // Extract back to model
  const extracted = extractFromDb(db, database.name);

  // Debug: check extracted junction tables
  console.log('\nExtracted junction tables:');
  for (const table of extracted.tables) {
    if (table.name.includes('part_of') || table.name.includes('depends')) {
      console.log(`  ${table.name}: ${table.rows.length} rows`);
      for (const row of table.rows.slice(0, 3)) { // Show first 3 rows
        console.log(`    Name: "${row.name}"`);
        console.log(`    Anchor: "${row.anchor}"`);
        console.log(`    Columns:`, row.columns);
      }
    }
  }

  // Render to Mermaid
  const result = renderToMermaid(extracted);

  // Check for warnings
  console.log(`Render warnings: ${result.warnings.length}`);
  result.warnings.forEach(w => console.log(`  - ${w.message}`));

  assert.strictEqual(result.warnings.length, 0, 'Should have no warnings with metadata');

  const rendered = result.mermaid;

  // Debug: print the rendered output
  console.log('Rendered output:');
  console.log(rendered);
  console.log('---');

  // Validate the rendered output
  assert.ok(rendered.includes('---'), 'Should have frontmatter');
  assert.ok(rendered.includes('title: Piste Perfect Project Planner'), 'Should preserve database name');
  assert.ok(rendered.includes('classDiagram'), 'Should have classDiagram');
  assert.ok(rendered.includes('namespace task {'), 'Should have task namespace');

  // Check that key rows are present
  assert.ok(rendered.includes('class EAR:::task{'), 'Should have EAR row');
  assert.ok(rendered.includes('class CGL:::task{'), 'Should have CGL row');

  // Check that relationships are preserved
  // Search for arrows in the output
  const arrowLines = rendered
      .split('\n')
      .filter(line => /^\w+ [.*<>|-]+ \w+/.test(line));
  console.log(`Found ${arrowLines.length} arrow lines:`);
  arrowLines.forEach(line => console.log(`  ${line}`));

  // For now, just check if there are arrows
  assert.ok(arrowLines.length > 0, 'Should have at least one arrow');

  // Check specific arrows (alphabetically sorted FK columns mean arrows might be reversed)
  // assert.ok(rendered.includes('CGL_Impl ..> CGL_Spec'), 'Should have dependency relationship');

  // Check specific arrows (exact tokens from metadata)
  assert.ok(rendered.includes('EAR *-- CGL'), 'Should have composition relationship');
  assert.ok(rendered.includes('CGL_Impl ..> CGL_Spec'), 'Should have dependency relationship');

  // Check that arrow mappings are from metadata (exact as parsed)
  assert.ok(
    rendered.includes('%% parent_task_id *-- child_task_id : task_part_of'),
    'Should have composition arrow mapping from metadata'
  );
  assert.ok(
    rendered.includes('%% dependent_task_id ..> prerequisite_task_id : task_depends_on'),
    'Should have dependency arrow mapping from metadata'
  );

  // Validate that we can re-parse the rendered output
  const reparsed = parseMermaid(rendered);
  assert.strictEqual(reparsed.errors.length, 0, 'Re-parsing rendered output should succeed');
  assert.strictEqual(reparsed.databases.length, 1, 'Re-parsed should have 1 database');

  const reparsedDb = reparsed.databases[0]!;
  assert.strictEqual(reparsedDb.name, database.name, 'Database name should be preserved');

  // Find the task table in both
  const originalTaskTable = database.tables.find(t => t.name === 'task');
  const reparsedTaskTable = reparsedDb.tables.find(t => t.name === 'task');

  assert.ok(originalTaskTable, 'Original should have task table');
  assert.ok(reparsedTaskTable, 'Reparsed should have task table');

  // Row count should match (at least the non-junction tables)
  assert.ok(
    reparsedTaskTable!.rows.length > 0,
    'Reparsed should have task rows'
  );

  console.log(`✓ Round-trip test passed!`);
  console.log(`  Original rows: ${originalTaskTable!.rows.length}`);
  console.log(`  Extracted rows: ${extracted.tables.find(t => t.name === 'task')?.rows.length}`);
  console.log(`  Reparsed rows: ${reparsedTaskTable!.rows.length}`);
});

test('integration - preserves IDs for UPSERT', async () => {
  // Create a simple Mermaid with explicit IDs
  const mermaid = `---
title: Test Database
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
    class T1:::task{
    id: 42
    name: Task One
    task_type: feature
    }
}
`;

  // Parse
  const parseResult = parseMermaid(mermaid);
  assert.strictEqual(parseResult.errors.length, 0, 'Parsing should succeed');

  const database = parseResult.databases[0]!;

  // Compile
  const db = await compileToSqlite([database]);

  // Extract
  const extracted = extractFromDb(db, database.name);

  // Render
  const { mermaid: rendered } = renderToMermaid(extracted);

  // Check that ID is preserved
  assert.ok(rendered.includes('id: 42'), 'Should preserve explicit ID for UPSERT');

  console.log('✓ ID preservation test passed!');
});
