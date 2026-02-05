/**
 * Tests for the markdown parser.
 */

import {test, describe} from 'node:test';
import assert from 'node:assert';
import {parseMarkdown} from './parse.js';
import {validateModel} from './validate.js';
import {parseHeading} from './heading.js';

describe('parseHeading', () => {
    test('parses simple name', () => {
        const result = parseHeading('Early Access Release');
        assert.strictEqual(result.name, 'Early Access Release');
        assert.strictEqual(result.pk, undefined);
        assert.strictEqual(result.explicitAnchor, undefined);
        assert.deepStrictEqual(result.tags, []);
    });

    test('parses name with PK', () => {
        const result = parseHeading('Early Access Release `PK: 42`');
        assert.strictEqual(result.name, 'Early Access Release');
        assert.strictEqual(result.pk, 42);
        assert.strictEqual(result.explicitAnchor, undefined);
    });

    test('parses name with PK and anchor', () => {
        const result = parseHeading('Early Access Release `PK: 42` {#ear}');
        assert.strictEqual(result.name, 'Early Access Release');
        assert.strictEqual(result.pk, 42);
        assert.strictEqual(result.explicitAnchor, 'ear');
    });

    test('parses name with anchor only', () => {
        const result = parseHeading('Early Access Release {#ear}');
        assert.strictEqual(result.name, 'Early Access Release');
        assert.strictEqual(result.pk, undefined);
        assert.strictEqual(result.explicitAnchor, 'ear');
    });

    test('parses @database tag', () => {
        const result = parseHeading('Tracker @database');
        assert.strictEqual(result.name, 'Tracker');
        assert.deepStrictEqual(result.tags, ['database']);
    });

    test('parses @database tag with anchor', () => {
        const result = parseHeading('Tracker @database {#my-db}');
        assert.strictEqual(result.name, 'Tracker');
        assert.deepStrictEqual(result.tags, ['database']);
        assert.strictEqual(result.explicitAnchor, 'my-db');
    });
});

describe('parseMarkdown', () => {
    test('parses database with table and rows', () => {
        const markdown = `
# Test Database @database {#test-db}

## Task

\`\`\`sql
CREATE TABLE task (
    task_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0
);
\`\`\`

### First Task

#### Columns

    priority: 1

### Second Task \`PK: 42\`

#### Columns

    priority: 2

#### Relationships

##### Depends On
- [First Task](#first-task)
`;

        const result = parseMarkdown(markdown);

        assert.strictEqual(result.errors.length, 0);
        assert.strictEqual(result.databases.length, 1);

        const db = result.databases[0]!;
        assert.strictEqual(db.name, 'Test Database');
        assert.strictEqual(db.tables.length, 1);

        const table = db.tables[0]!;
        assert.strictEqual(table.name, 'Task');
        assert.strictEqual(table.rows.length, 2);

        const row1 = table.rows[0]!;
        assert.strictEqual(row1.name, 'First Task');
        assert.strictEqual(row1.anchor, 'first-task');
        assert.strictEqual(row1.pk, undefined);
        assert.strictEqual(row1.columns['priority'], 1);

        const row2 = table.rows[1]!;
        assert.strictEqual(row2.name, 'Second Task');
        assert.strictEqual(row2.pk, 42);
        assert.strictEqual(row2.columns['priority'], 2);

        const deps = row2.relationships['Depends On'];
        assert.strictEqual(deps?.length, 1);
        assert.strictEqual(deps?.[0]?.targetAnchor, 'first-task');
    });

    test('ignores H1 without @database tag', () => {
        const markdown = `
# Just a Title

## Not a Table

Some content here.

# Actual DB @database

## Task

\`\`\`sql
CREATE TABLE task (task_id INTEGER PRIMARY KEY, name TEXT);
\`\`\`

### Task A
`;

        const result = parseMarkdown(markdown);

        assert.strictEqual(result.databases.length, 1);
        assert.strictEqual(result.databases[0]!.name, 'Actual DB');
    });

    test('validates model correctly', () => {
        const markdown = `
# Test DB @database

## Task

\`\`\`sql
CREATE TABLE task (task_id INTEGER PRIMARY KEY, name TEXT);
\`\`\`

### Task A

### Task B

#### Relationships

##### Depends On
- [Task A](#task-a)
`;

        const result = parseMarkdown(markdown);
        const validation = validateModel(result.databases);

        assert.strictEqual(validation.valid, true);
    });

});
