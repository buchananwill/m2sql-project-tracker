/**
 * Tests for SQLite compilation and extraction.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { compileToSqlite } from './compile.js';
import { extractFromDb } from './extract.js';
import { parseMarkdown } from '@m2sql/parser';

/** Helper: query all rows from a sql.js database */
function queryAll(db: import('sql.js').Database, sql: string): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

describe('compileToSqlite', () => {
  test('creates tables and inserts rows', async () => {
    const markdown = `
# Test DB @database

## task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    anchor TEXT UNIQUE,
    priority INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT ''
);
\`\`\`

### First Task

#### Columns

    priority: 1
    notes: "The first task"

### Second Task

#### Columns

    priority: 2
`;

    const result = parseMarkdown(markdown);
    assert.strictEqual(result.errors.length, 0);

    const db = await compileToSqlite(result.databases);
    try {
      const rows = queryAll(db, 'SELECT * FROM task ORDER BY task_id');
      assert.strictEqual(rows.length, 2);

      assert.strictEqual(rows[0]!['name'], 'First Task');
      assert.strictEqual(rows[0]!['anchor'], 'first-task');
      assert.strictEqual(rows[0]!['priority'], 1);
      assert.strictEqual(rows[0]!['notes'], 'The first task');

      assert.strictEqual(rows[1]!['name'], 'Second Task');
      assert.strictEqual(rows[1]!['anchor'], 'second-task');
      assert.strictEqual(rows[1]!['priority'], 2);
    } finally {
      db.close();
    }
  });

  test('inserts rows with explicit PK', async () => {
    const markdown = `
# Test DB @database

## task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    anchor TEXT UNIQUE
);
\`\`\`

### My Task \`PK: 99\`
`;

    const result = parseMarkdown(markdown);
    const db = await compileToSqlite(result.databases);
    try {
      const rows = queryAll(db, 'SELECT * FROM task');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0]!['task_id'], 99);
      assert.strictEqual(rows[0]!['name'], 'My Task');
    } finally {
      db.close();
    }
  });

  test('resolves part_of relationships into junction table', async () => {
    const markdown = `
# Test DB @database

## task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    anchor TEXT UNIQUE
);
\`\`\`

### Parent Task

### Child Task

#### Relationships

##### Part Of
- parent: [Parent Task](#parent-task)

## task_part_of

\`\`\`sql
CREATE TABLE task_part_of (
    child_task_id INTEGER NOT NULL,
    parent_task_id INTEGER NOT NULL,
    PRIMARY KEY (child_task_id, parent_task_id),
    FOREIGN KEY (child_task_id) REFERENCES task(task_id),
    FOREIGN KEY (parent_task_id) REFERENCES task(task_id)
);
\`\`\`
`;

    const result = parseMarkdown(markdown);
    assert.strictEqual(result.errors.length, 0);

    const db = await compileToSqlite(result.databases);
    try {
      const tasks = queryAll(db, 'SELECT * FROM task ORDER BY task_id');
      assert.strictEqual(tasks.length, 2);

      const junctions = queryAll(db, 'SELECT * FROM task_part_of');
      assert.strictEqual(junctions.length, 1);

      const parentId = tasks.find(t => t['name'] === 'Parent Task')!['task_id'];
      const childId = tasks.find(t => t['name'] === 'Child Task')!['task_id'];

      assert.strictEqual(junctions[0]!['child_task_id'], childId);
      assert.strictEqual(junctions[0]!['parent_task_id'], parentId);
    } finally {
      db.close();
    }
  });

  test('resolves depends_on relationships', async () => {
    const markdown = `
# Test DB @database

## task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    anchor TEXT UNIQUE
);
\`\`\`

### Design Phase

### Build Phase

#### Relationships

##### Depends On
- [Design Phase](#design-phase)

## task_depends_on

\`\`\`sql
CREATE TABLE task_depends_on (
    task_id INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, depends_on_task_id),
    FOREIGN KEY (task_id) REFERENCES task(task_id),
    FOREIGN KEY (depends_on_task_id) REFERENCES task(task_id)
);
\`\`\`
`;

    const result = parseMarkdown(markdown);
    const db = await compileToSqlite(result.databases);
    try {
      const tasks = queryAll(db, 'SELECT * FROM task ORDER BY task_id');
      const junctions = queryAll(db, 'SELECT * FROM task_depends_on');

      assert.strictEqual(junctions.length, 1);

      const designId = tasks.find(t => t['name'] === 'Design Phase')!['task_id'];
      const buildId = tasks.find(t => t['name'] === 'Build Phase')!['task_id'];

      assert.strictEqual(junctions[0]!['task_id'], buildId);
      assert.strictEqual(junctions[0]!['depends_on_task_id'], designId);
    } finally {
      db.close();
    }
  });
});

describe('extractFromDb', () => {
  test('round-trips through compile and extract', async () => {
    const markdown = `
# Test DB @database

## task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    anchor TEXT UNIQUE,
    priority INTEGER NOT NULL DEFAULT 0
);
\`\`\`

### Alpha Task

#### Columns

    priority: 1

### Beta Task

#### Columns

    priority: 2
`;

    const parsed = parseMarkdown(markdown);
    const db = await compileToSqlite(parsed.databases);
    try {
      const extracted = extractFromDb(db, 'Test DB');

      const taskTable = extracted.tables.find(t => t.name === 'task');
      assert.ok(taskTable);
      assert.strictEqual(taskTable.rows.length, 2);

      const alpha = taskTable.rows.find(r => r.name === 'Alpha Task');
      assert.ok(alpha);
      assert.strictEqual(alpha.anchor, 'alpha-task');
      assert.strictEqual(alpha.columns['priority'], 1);

      const beta = taskTable.rows.find(r => r.name === 'Beta Task');
      assert.ok(beta);
      assert.strictEqual(beta.columns['priority'], 2);
    } finally {
      db.close();
    }
  });
});
