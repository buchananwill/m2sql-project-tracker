# m2sql Project Tracker

## Overview

A TypeScript monorepo that compiles structured markdown documents into SQLite databases, syncs them to Supabase, and renders them back to markdown. Designed to allow authoring project tracking data in plain text from any device (mobile, laptop, offline), then compiling to a relational format for analysis and visualization.

## Pipeline

```
Markdown  -->  SQLite  -->  Supabase  -->  Web UI (Next.js)
   ^                                          |
   |                                          |
   +------------------------------------------+
              (export to markdown)
```

## Core Design Decisions

### Markdown Format (Authoring)

- **H1** defines a database (tagged with `@database` inline, e.g., `# Tracker @database`)
- **H2** defines a table (SQL schema in a fenced code block)
- **H3** defines a row, with optional PK and explicit anchor: `### Row Name \`PK: 42\` {#explicit-anchor}`
- **H4 `#### Columns`** begins YAML-style column values for the parent row
- **H4 `#### Relationships`** begins relationship entries, with **H5** subheadings for relationship type (e.g., `##### Part Of`, `##### Depends On`) followed by bullet lists with markdown links to other rows

### Primary Keys

- Integer primary keys throughout. Anchors (auto-slugified from heading text, or explicitly set) serve as unique secondary identifiers for sync matching.
- When exporting from a database, PKs are included in the heading: `### Row Name \`PK: 42\``
- When authoring new rows, PKs are omitted. The system assigns them on insert.

### ID Matching (Sync)

When syncing from SQLite to Supabase, rows are matched in this order:
1. By explicit PK (if present in the markdown)
2. By exact row name match within the table
3. If neither matches, create a new row

Row names must be unique per table.

### Source of Truth

- **Supabase** is the canonical source of truth.
- Markdown is an authoring/input format that can insert and update rows, but **never delete**.
- Deletion is only performed via Supabase directly.
- A complete markdown export from Supabase serves as a backup. An empty or partial markdown file cannot delete database contents.

### Ordering (Export)

When rendering from database to markdown, row order is derived from relationships and metadata:
1. `part_of` hierarchy (parents above children)
2. `depends_on` topological sort (prerequisites before dependants)
3. `priority` ascending (lower number = higher importance, read as "1st, 2nd, 3rd")
4. `created_utc` ascending (older first)

Cross-branch dependencies do not reorder entire subtrees; they are documented in the relationship section only.

## Quick Reference

### Example

See `examples/piste_perfect_project_tracker.md` for a full real-world example — a project tracker for a skiing game with ~40 tasks, `part_of` hierarchy, `depends_on` chains, and multiple table schemas including junction tables.

### Parsing Rules

1. H1 headings are only treated as databases if they contain the `@database` tag. H1 headings without it are silently ignored, allowing document-level notes and rules above the data.
2. Heading syntax is parsed right-to-left: `### Name \`PK: 42\` {#anchor}`. The anchor is extracted first, then the PK, then the remaining text is the name. Order matters.
3. Anchors are auto-slugified from heading text (e.g., `Early Access Release` becomes `early-access-release`) unless an explicit `{#anchor}` is provided.
4. Column values under `#### Columns` are indented plain text in `key: value` format. Quoted string values have quotes stripped. Unquoted numeric values are parsed as numbers.
5. Relationships are structured as `#### Relationships` > `##### Type Name` > bullet list with markdown links. The link target `(#anchor)` resolves to the referenced row.
6. Junction tables are inferred by naming convention: a relationship type "Part Of" on a `task` table looks for `task_part_of`, then `part_of`. The FK columns are matched by their `REFERENCES` clauses.

### Build Setup

Each package has two tsconfig files:
- `tsconfig.json` — includes all files (source + tests), used by the IDE for type checking
- `tsconfig.build.json` — extends `tsconfig.json` but excludes `*.test.ts`, used by `pnpm build`

Tests use Node.js built-in test runner with `tsx` for TypeScript support: `node --test --import tsx src/**/*.test.ts`

## Packages

| Package | Status | Purpose |
|---------|--------|---------|
| `@m2sql/model` | Done | Shared type definitions, SQL schema parsing, validation types |
| `@m2sql/parser` | Done | Markdown to semantic model (remark/unified AST walker) |
| `@m2sql/sqlite` | Done | Model to SQLite compilation, SQLite to model extraction |
| `@m2sql/renderer` | Not started | Model to markdown (topological sort, PK annotations) |
| `@m2sql/supabase` | Not started | SQLite to Supabase sync (upsert only), Supabase to model export |
| `@m2sql/cli` | Not started | CLI orchestration of the above |

## Apps

| App | Status | Purpose |
|-----|--------|---------|
| `apps/web` | Not started | Next.js website for visualization (node graphs, Gantt charts, toggle-list trees) |

## What Has Been Implemented

### @m2sql/model (Phase 1)

- `types.ts` - Semantic model interfaces: `Database`, `Table`, `Row`, `ColumnValues`, `Relationships`, `ParseResult`, `ValidationResult`
- `schema.ts` - SQL `CREATE TABLE` parser producing `TableSchema` with columns, primary keys, foreign keys, defaults, unique/check constraints
- Column value validation against schema definitions

### @m2sql/parser (Phase 1)

- Markdown to AST via `unified` / `remark-parse`
- `@database` inline tag on H1 headings to mark database sections (H1 without the tag is ignored)
- Heading parser extracts name, `PK: n`, explicit `{#anchor}`, and `@tags` from a single heading line
- Auto-slugified anchors via `github-slugger`, with explicit anchor override support
- YAML-style column value parsing from indented text under `#### Columns`
- Relationship parsing: `#### Relationships` > `##### Type` > bullet list with markdown links
- Roles on relationship entries (e.g., `parent: [Target](#anchor)`)
- Recursive `getTextContent` for headings with inline formatting (bold, italic, links)
- Validation: duplicate anchors, duplicate row names per table, unresolved references, cycle detection in `part_of` and `depends_on` graphs
- 10 passing tests

### @m2sql/sqlite (Phase 2)

- `compileToSqlite(databases)` - creates tables from raw SQL, inserts rows with name/anchor/column values, auto-adds `anchor` column if missing from schema
- Explicit PK insertion when `PK: n` is present in the heading
- Junction table inference: maps relationship types (e.g., "Part Of") to junction tables (e.g., `task_part_of`) by matching naming conventions and foreign key references
- Anchor-to-ID resolution for populating junction table foreign keys
- `extractFromDb(db, name)` - reads tables, rows, and junction relationships back into the semantic model; reverse-resolves junction entries to anchors
- `exportDatabase(db)` - serializes the in-memory database to `Uint8Array` for file output
- Uses `sql.js` (WASM-based SQLite) - no native compilation required
- 5 passing tests (including round-trip compile/extract)

## What Remains Outstanding

### Phase 3: Markdown Rendering (`@m2sql/renderer`)

- Model to markdown output with PKs, anchors, and schema blocks
- Topological sort for row ordering based on `part_of` hierarchy, `depends_on` edges, `priority` (ascending), and `created_utc` (ascending)
- Cross-branch dependency annotation without subtree reordering

### Phase 4: Supabase Sync (`@m2sql/supabase`)

- UPSERT to Supabase: match by PK first, then exact row name, then create new
- Junction table FK translation: local SQLite IDs to Supabase IDs via anchor mapping
- Insert/update only - no deletion from Supabase
- Export from Supabase to semantic model

### Phase 5: CLI (`@m2sql/cli`)

- `compile` command: markdown to .db file
- `validate` command: check markdown syntax without compiling
- `sync` command: .db file to Supabase
- `export` command: Supabase to markdown
- Config file support (`.pp-trackerrc.json`)
- Environment variable handling for Supabase credentials

### Phase 6: Web UI (`apps/web`)

- Next.js application
- Graphical relational views: node graphs, Gantt charts, toggle-list trees
- Supabase integration for live data

## CLI Commands (Planned)

```bash
pp-tracker compile input.md -o tracker.db
pp-tracker validate input.md
pp-tracker sync tracker.db --project <supabase-url> --key <anon-key>
pp-tracker export --project <supabase-url> --key <anon-key> -o backup.md
```

## Tech Stack

- **Language:** TypeScript
- **Monorepo:** pnpm workspaces
- **Markdown parsing:** unified / remark-parse / mdast
- **SQLite:** sql.js (WASM-based, no native compilation)
- **Supabase client:** @supabase/supabase-js (planned)
- **CLI:** commander (planned)
- **Web:** Next.js (planned)
- **Config:** JSON (`.pp-trackerrc.json`)
- **Test runner:** Node.js built-in test runner with tsx
