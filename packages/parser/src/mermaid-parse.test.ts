/**
 * Tests for the Mermaid classDiagram parser.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseMermaid } from './mermaid-parse.js';
import { extractFrontmatter } from './mermaid-frontmatter.js';
import { parseClassAttributes } from './mermaid-attributes.js';
import { parseHeader } from './mermaid-header.js';
import { parseClassDiagramBody } from './mermaid-body.js';
import { parseArrow } from './mermaid-arrows.js';

describe('extractFrontmatter', () => {
  test('extracts YAML frontmatter', () => {
    const content = `%% SQL header
---
title: My Database
config:
  look: handDrawn
---
classDiagram
`;
    const { frontmatter, remainingContent } = extractFrontmatter(content);
    assert.strictEqual(frontmatter.title, 'My Database');
    assert.deepStrictEqual(frontmatter.config, { look: 'handDrawn' });
    assert.ok(remainingContent.includes('classDiagram'));
  });

  test('handles missing frontmatter', () => {
    const content = `classDiagram\nnamespace task {}`;
    const { frontmatter, remainingContent } = extractFrontmatter(content);
    assert.deepStrictEqual(frontmatter, {});
    assert.strictEqual(remainingContent, content);
  });
});

describe('parseClassAttributes', () => {
  test('parses name and columns', () => {
    const body = `
name: Early Access Release
task_type: milestone
hours_estimate: 2000
`;
    const { name, pk, columns } = parseClassAttributes(body);
    assert.strictEqual(name, 'Early Access Release');
    assert.strictEqual(pk, undefined);
    assert.strictEqual(columns.task_type, 'milestone');
    assert.strictEqual(columns.hours_estimate, 2000);
  });

  test('parses name and id', () => {
    const body = `
name: Some Task
id: 42
status: active
`;
    const { name, pk, columns } = parseClassAttributes(body);
    assert.strictEqual(name, 'Some Task');
    assert.strictEqual(pk, 42);
    assert.strictEqual(columns.status, 'active');
  });

  test('handles null values', () => {
    const body = `
name: Task
description: null
`;
    const { name, columns } = parseClassAttributes(body);
    assert.strictEqual(name, 'Task');
    assert.strictEqual(columns.description, null);
  });

  test('handles quoted strings', () => {
    const body = `
name: Task
label: "quoted value"
`;
    const { name, columns } = parseClassAttributes(body);
    assert.strictEqual(name, 'Task');
    assert.strictEqual(columns.label, 'quoted value');
  });
});

describe('parseHeader', () => {
  test('parses CREATE TABLE statements', () => {
    const content = `%% CREATE TABLE task (
%%   task_type TEXT,
%%   hours_estimate INTEGER
%% );
---
`;
    const { schemas, rawSql, arrowMappings } = parseHeader(content);
    assert.ok(schemas.has('task'));
    const taskSchema = schemas.get('task');
    assert.strictEqual(taskSchema?.name, 'task');
    assert.strictEqual(taskSchema?.columns.length, 2);
    assert.ok(rawSql.has('task'));
  });

  test('parses arrow mappings', () => {
    const content = `%% parent_id *-- child_id : task_part_of
%% dependent_id ..> prerequisite_id : task_depends_on
---
`;
    const { arrowMappings } = parseHeader(content);
    const partOfMapping = arrowMappings.get('*--');
    assert.strictEqual(partOfMapping?.leftColumn, 'parent_id');
    assert.strictEqual(partOfMapping?.rightColumn, 'child_id');
    assert.strictEqual(partOfMapping?.junctionTable, 'task_part_of');

    const dependsMapping = arrowMappings.get('..>');
    assert.strictEqual(dependsMapping?.leftColumn, 'dependent_id');
    assert.strictEqual(dependsMapping?.rightColumn, 'prerequisite_id');
    assert.strictEqual(dependsMapping?.junctionTable, 'task_depends_on');
  });

  test('parses multiple tables and arrows', () => {
    const content = `%% CREATE TABLE task (
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
---
`;
    const { schemas, arrowMappings } = parseHeader(content);
    assert.strictEqual(schemas.size, 2);
    assert.ok(schemas.has('task'));
    assert.ok(schemas.has('task_part_of'));
    assert.strictEqual(arrowMappings.get('*--')?.junctionTable, 'task_part_of');
  });
});

describe('parseClassDiagramBody', () => {
  test('extracts namespaces and classes', () => {
    const content = `classDiagram

namespace task {
    class EAR:::task{
    name: Early Access Release
    task_type: milestone
    hours_estimate: 2000
    }

    class CGL:::task{
    name: Complete Core Game Loop
    task_type: gameplay logic
    }
}
`;
    const { namespaces, arrows } = parseClassDiagramBody(content);
    assert.ok(namespaces.has('task'));
    const taskClasses = namespaces.get('task');
    assert.strictEqual(taskClasses?.length, 2);
    assert.strictEqual(taskClasses?.[0]?.anchor, 'EAR');
    assert.strictEqual(taskClasses?.[0]?.name, 'Early Access Release');
    assert.strictEqual(taskClasses?.[1]?.anchor, 'CGL');
  });

  test('extracts arrow lines', () => {
    const content = `classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}

A *-- B
A ..> C
`;
    const { arrows } = parseClassDiagramBody(content);
    assert.strictEqual(arrows.length, 2);
    assert.ok(arrows.includes('A *-- B'));
    assert.ok(arrows.includes('A ..> C'));
  });
});

describe('parseArrow', () => {
  test('parses arrow without label', () => {
    const arrow = parseArrow('EAR *-- CGL');
    assert.strictEqual(arrow?.lhsAnchor, 'EAR');
    assert.strictEqual(arrow?.arrowToken, '*--');
    assert.strictEqual(arrow?.rhsAnchor, 'CGL');
    assert.strictEqual(arrow?.label, undefined);
  });

  test('parses arrow with label', () => {
    const arrow = parseArrow('EAR *-- CGL : "parent of"');
    assert.strictEqual(arrow?.lhsAnchor, 'EAR');
    assert.strictEqual(arrow?.arrowToken, '*--');
    assert.strictEqual(arrow?.rhsAnchor, 'CGL');
    assert.strictEqual(arrow?.label, 'parent of');
  });

  test('handles various arrow tokens', () => {
    const arrow1 = parseArrow('A ..> B');
    assert.strictEqual(arrow1?.arrowToken, '..>');

    const arrow2 = parseArrow('A --> B');
    assert.strictEqual(arrow2?.arrowToken, '-->');

    const arrow3 = parseArrow('A <|-- B');
    assert.strictEqual(arrow3?.arrowToken, '<|--');
  });
});

describe('parseMermaid - integration', () => {
  test('parses complete example file', () => {
    const content = `%% CREATE TABLE task (
%%   task_type TEXT,
%%   hours_estimate INTEGER
%% );
%%
%% CREATE TABLE task_part_of (
%%   parent_task_id INTEGER REFERENCES task(id),
%%   child_task_id INTEGER REFERENCES task(id),
%%   label TEXT,
%%   PRIMARY KEY (parent_task_id, child_task_id)
%% );
%%
%% parent_task_id *-- child_task_id : task_part_of
---
title: Project Planner
---
classDiagram

namespace task {
    class EAR:::task{
    name: Early Access Release
    task_type: milestone
    hours_estimate: 2000
    }

    class CGL:::task{
    name: Complete Core Game Loop
    task_type: gameplay logic
    hours_estimate: 500
    }
}

EAR *-- CGL
`;

    const result = parseMermaid(content);

    assert.strictEqual(result.databases.length, 1);
    const db = result.databases[0];
    assert.strictEqual(db?.name, 'Project Planner');

    assert.strictEqual(db?.tables.length, 1);
    const taskTable = db?.tables[0];
    assert.strictEqual(taskTable?.name, 'task');
    assert.strictEqual(taskTable?.rows.length, 2);

    const earRow = taskTable?.rows.find(r => r.anchor === 'EAR');
    assert.strictEqual(earRow?.name, 'Early Access Release');
    assert.strictEqual(earRow?.columns.task_type, 'milestone');
    assert.strictEqual(earRow?.columns.hours_estimate, 2000);

    // Check relationships - CGL (child) should point to EAR (parent)
    const cglRow = taskTable?.rows.find(r => r.anchor === 'CGL');
    assert.ok(cglRow?.relationships.task_part_of);
    assert.strictEqual(cglRow?.relationships.task_part_of?.length, 1);
    assert.strictEqual(cglRow?.relationships.task_part_of?.[0]?.targetAnchor, 'EAR');
  });

  test('handles missing name attribute', () => {
    const content = `%% CREATE TABLE task (
%%   status TEXT
%% );
---
title: Test
---
classDiagram

namespace task {
    class A:::task{
    status: active
    }
}
`;

    const result = parseMermaid(content);
    // When all classes are invalid, the namespace has no classes, so table is created with 0 rows
    assert.strictEqual(result.databases[0]?.tables.length, 1);
    assert.strictEqual(result.databases[0]?.tables[0]?.rows.length, 0);
  });

  test('handles unresolved arrow mappings', () => {
    const content = `%% CREATE TABLE task (
%%   status TEXT
%% );
---
title: Test
---
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}

A *-- B
`;

    const result = parseMermaid(content);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.message.includes('No arrow mapping')));
  });

  test('validates FK table match', () => {
    const content = `%% CREATE TABLE task (
%%   status TEXT
%% );
%%
%% CREATE TABLE wrong_table (
%%   other_id INTEGER REFERENCES other(id),
%%   another_id INTEGER REFERENCES another(id),
%%   PRIMARY KEY (other_id, another_id)
%% );
%%
%% other_id *-- another_id : wrong_table
---
title: Test
---
classDiagram

namespace task {
    class A:::task{name: Task A}
    class B:::task{name: Task B}
}

A *-- B
`;

    const result = parseMermaid(content);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.message.includes('references')));
  });
});
