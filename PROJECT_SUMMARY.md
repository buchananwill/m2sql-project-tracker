# m2sql Project Tracker

## Overview

A TypeScript monorepo that compiles Mermaid `classDiagram` files into SQLite databases, syncs them to Supabase, and exports them back to Mermaid. Designed to allow authoring project tracking data in plain text from any device (mobile, laptop, offline), with the added benefit that `.mmd` files render as readable diagrams in any Mermaid-compatible viewer.

## Pipeline

```
Mermaid (.mmd)  -->  AST  -->  SQLite  -->  Supabase  -->  Web UI (Next.js)
      ^                                                        |
      |                                                        |
      +--------------------------------------------------------+
                        (export to mermaid)
```

## Core Design Decisions

### Mermaid Format (Authoring)

The authoring format uses Mermaid's `classDiagram` syntax. See `MERMAID_RULESHEET.md` for the full specification.

- **`namespace`** declares a table (e.g., `namespace task { ... }`)
- **`class`** declares a row, with the class identifier as the row's anchor (e.g., `class EAR { ... }`)
- **Class body** contains `key: value` column data, including a required `name:` attribute
- **Arrows** between classes declare relationships, mapped to junction tables via header directives
- **Commented SQL** (`%%`) at the top of the file declares table schemas and arrow-to-junction-table mappings
- **`:::style`** suffix on classes is optional and purely visual (no parsing impact)

### SQL Schema Header

Table schemas are declared as commented-out SQL at the top of the `.mmd` file, before the frontmatter. This includes data tables, junction tables, and arrow mappings:

```
%% CREATE TABLE task (
%%   task_type TEXT,
%%   hours_estimate INTEGER
%% );
%%
%% CREATE TABLE task_part_of (
%%   parent_task_id INTEGER REFERENCES task(id),
%%   child_task_id INTEGER REFERENCES task(id),
%%   PRIMARY KEY (parent_task_id, child_task_id)
%% );
%%
%% *-- task_part_of
```

### Auto-Managed Columns

Three columns are always present on every data table and do not need to be declared in the schema:

| Column | Type | Behaviour |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY` | Auto-assigned. If a row declares `id:`, used for UPSERT. |
| `name` | `TEXT NOT NULL` | From the `name:` class attribute. |
| `anchor` | `TEXT UNIQUE NOT NULL` | From the class identifier. |

### Schema Flexibility

If a row attribute doesn't match a declared column, a new column is added with type `TEXT`. The SQL schema is authoritative for types -- no value sniffing.

### Relationships

Relationship types are not hard-coded. Any valid Mermaid arrow syntax can be mapped to a declared junction table. Arrow directions follow UML conventions. The LHS of an arrow maps to the first FK in the junction table, the RHS to the second.

Junction tables may include an optional `label TEXT` column, populated via Mermaid's `: label` syntax on arrows.

### UPSERT Matching

When syncing, rows are matched in this order:
1. By explicit `id:` (if present and a row with that PK exists)
2. By exact `name:` match within the table
3. If neither matches, create a new row

Row names must be unique per table.

### Source of Truth

- **Supabase** is the canonical source of truth.
- Mermaid is an authoring/input format that can insert and update rows, but **never delete**.
- Deletion is only performed via Supabase directly.
- A complete Mermaid export from Supabase serves as a backup. An empty or partial `.mmd` file cannot delete database contents.

### Ordering (Export)

When exporting from database to Mermaid, row order within a namespace is derived from:
1. Composition hierarchy (parents before children)
2. Dependency topological sort (prerequisites before dependants)
3. `priority` ascending (lower number = higher importance)
4. `created_utc` ascending (older first)

## Quick Reference

### Example

See `examples/project-planner.mmd` for a working example -- a project tracker for a skiing game with composition and dependency relationships.

### Build Setup

Each package has two tsconfig files:
- `tsconfig.json` — includes all files (source + tests), used by the IDE for type checking
- `tsconfig.build.json` — extends `tsconfig.json` but excludes `*.test.ts`, used by `pnpm build`

Tests use Node.js built-in test runner with `tsx` for TypeScript support: `node --test --import tsx src/**/*.test.ts`

## Packages

| Package | Status | Purpose |
|---------|--------|---------|
| `@m2sql/model` | Needs update | Shared type definitions, SQL schema parsing, validation types |
| `@m2sql/parser` | Needs rewrite | Mermaid `.mmd` to semantic model |
| `@m2sql/sqlite` | Needs update | Model to SQLite compilation, SQLite to model extraction |
| `@m2sql/renderer` | Not started | Model to Mermaid export (topological sort, PK annotations) |
| `@m2sql/supabase` | Not started | SQLite to Supabase sync (upsert only), Supabase to model export |
| `@m2sql/cli` | Not started | CLI orchestration of the above |

## Apps

| App | Status | Purpose |
|-----|--------|---------|
| `apps/web` | Not started | Next.js website for visualization (node graphs, Gantt charts, toggle-list trees) |

## What Has Been Implemented (Markdown Era)

The following packages were built for the original markdown-based format. They need to be updated or rewritten for the Mermaid-based format.

### @m2sql/model

- `types.ts` - Semantic model interfaces: `Database`, `Table`, `Row`, `ColumnValues`, `Relationships`, `ParseResult`, `ValidationResult`
- `schema.ts` - SQL `CREATE TABLE` parser producing `TableSchema` with columns, primary keys, foreign keys, defaults, unique/check constraints
- Column value validation against schema definitions

### @m2sql/parser

- Markdown to AST via `unified` / `remark-parse` -- **will be replaced with Mermaid parser**
- Heading parser, anchor slugification, column value parsing, relationship parsing, validation
- 10 passing tests (markdown format)

### @m2sql/sqlite

- `compileToSqlite(databases)` - creates tables, inserts rows, auto-adds `anchor` column
- Junction table inference, anchor-to-ID resolution, round-trip extraction
- Uses `sql.js` (WASM-based SQLite)
- 5 passing tests

## What Needs to Change

### Phase 1: Model Update (`@m2sql/model`)

- Update `types.ts` to reflect Mermaid-specific concepts (arrow mappings, junction table declarations)
- `schema.ts` SQL parser is reusable as-is (commented SQL uses the same `CREATE TABLE` syntax)
- Add types for arrow-to-junction-table mappings

### Phase 2: Parser Rewrite (`@m2sql/parser`)

- Replace remark/unified markdown parsing with Mermaid `classDiagram` parsing
- Parse commented SQL header: `CREATE TABLE` statements and arrow mapping directives
- Parse frontmatter for database name
- Parse namespaces as tables, classes as rows, class bodies as column values
- Parse relationship arrows and resolve to junction table mappings
- Validate: unique anchors, unique names per table, resolved references, arrow mappings exist, FK table matches, cycle detection

### Phase 3: SQLite Update (`@m2sql/sqlite`)

- Update compilation to use declared junction tables and arrow mappings instead of inferred junction tables
- Auto-managed column injection (`id`, `name`, `anchor`)
- Schema flexibility: auto-add TEXT columns for undeclared attributes
- UPSERT logic: match by `id:` first, then `name:`, then create new
- Extraction logic largely reusable

### Phase 4: Mermaid Export (`@m2sql/renderer`)

- Model to `.mmd` output with SQL header, frontmatter, namespaces, classes, and arrows
- Topological sort for row ordering
- Include `id:` in exported rows for round-trip UPSERT

### Phase 5: Supabase Sync (`@m2sql/supabase`)

- UPSERT to Supabase: match by PK, then name, then create new
- Junction table FK translation: local SQLite IDs to Supabase IDs via anchor mapping
- Insert/update only -- no deletion
- Export from Supabase to semantic model

### Phase 6: CLI (`@m2sql/cli`)

- `compile` command: `.mmd` to `.db` file
- `validate` command: check `.mmd` syntax without compiling
- `sync` command: `.db` file to Supabase
- `export` command: Supabase to `.mmd`
- Config file support
- Environment variable handling for Supabase credentials

### Phase 7: Web UI (`apps/web`)

- Next.js application
- Graphical relational views: node graphs, Gantt charts, toggle-list trees
- Supabase integration for live data

## CLI Commands (Planned)

```bash
m2sql compile input.mmd -o tracker.db
m2sql validate input.mmd
m2sql sync tracker.db --project <supabase-url> --key <anon-key>
m2sql export --project <supabase-url> --key <anon-key> -o backup.mmd
```

## Tech Stack

- **Language:** TypeScript
- **Monorepo:** pnpm workspaces
- **Mermaid parsing:** Custom parser for `classDiagram` subset
- **SQLite:** sql.js (WASM-based, no native compilation)
- **Supabase client:** @supabase/supabase-js (planned)
- **CLI:** commander (planned)
- **Web:** Next.js (planned)
- **Test runner:** Node.js built-in test runner with tsx
