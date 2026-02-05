/**
 * Integration test: Mermaid parse → compile to SQLite
 * Verifies the full pipeline works with Mermaid-parsed models.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { compileToSqlite } from './compile.js';
import { parseMermaid } from '@m2sql/parser';

describe('mermaid to sqlite compilation', () => {
  test('handles multiple databases', async () => {
    const mermaidContent = `---
title: Database 1
---
%% CREATE TABLE item (status TEXT);
classDiagram

namespace item {
    class A:::item{name: Item A}
}
`;

    const parseResult = parseMermaid(mermaidContent);
    assert.strictEqual(parseResult.databases.length, 1);

    const db = await compileToSqlite(parseResult.databases);

    const items = db.exec('SELECT name, anchor FROM item');
    assert.strictEqual(items[0]?.values.length, 1);
    assert.deepStrictEqual(items[0]?.values[0], ['Item A', 'A']);

    db.close();
  });

  test('handles rows with explicit PKs', async () => {
    const mermaidContent = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
classDiagram

namespace task {
    class A:::task{
    id: 42
    name: Task with explicit PK
    status: active
    }
}
`;

    const parseResult = parseMermaid(mermaidContent);
    const db = await compileToSqlite(parseResult.databases);

    const rows = db.exec('SELECT id, name, status FROM task');
    assert.strictEqual(rows[0]?.values.length, 1);
    assert.deepStrictEqual(rows[0]?.values[0], [42, 'Task with explicit PK', 'active']);

    db.close();
  });

  test('handles empty tables', async () => {
    const mermaidContent = `---
title: Test
---
%% CREATE TABLE task (status TEXT);
%% CREATE TABLE tag (name TEXT);
classDiagram

namespace task {
    class A:::task{name: Task A}
}
`;

    const parseResult = parseMermaid(mermaidContent);

    // Parser should create both tables (task with rows, tag empty)
    assert.strictEqual(parseResult.databases[0]?.tables.length, 2);
    const parsedTableNames = parseResult.databases[0]?.tables.map(t => t.name).sort();
    assert.deepStrictEqual(parsedTableNames, ['tag', 'task']);

    const db = await compileToSqlite(parseResult.databases);

    // Both tables should exist (from rawSql)
    const tables = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `);

    const tableNames = tables[0]?.values.map(row => row[0]) || [];
    assert.ok(tableNames.includes('task'));
    assert.ok(tableNames.includes('tag'));

    // task should have data, tag should be empty
    const taskRows = db.exec('SELECT COUNT(*) FROM task');
    assert.strictEqual(taskRows[0]?.values[0]?.[0], 1);

    const tagRows = db.exec('SELECT COUNT(*) FROM tag');
    assert.strictEqual(tagRows[0]?.values[0]?.[0], 0);

    db.close();
  });
});
