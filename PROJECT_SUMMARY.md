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

## Packages

| Package | Purpose |
|---------|---------|
| `@m2sql/model` | Shared type definitions, SQL schema parsing, validation types |
| `@m2sql/parser` | Markdown to semantic model (remark/unified AST walker) |
| `@m2sql/sqlite` | Model to SQLite compilation, SQLite to model extraction |
| `@m2sql/renderer` | Model to markdown (topological sort, PK annotations) |
| `@m2sql/supabase` | SQLite to Supabase sync (upsert only), Supabase to model export |
| `@m2sql/cli` | CLI orchestration of the above |

## Apps

| App | Purpose |
|-----|---------|
| `apps/web` | Next.js website for visualization (node graphs, Gantt charts, toggle-list trees) |

## CLI Commands (Planned)

```bash
pp-tracker compile input.md -o tracker.db
pp-tracker validate input.md
pp-tracker sync tracker.db --project <supabase-url> --key <anon-key>
pp-tracker export --project <supabase-url> --key <anon-key> -o backup.md
```

## Implementation Phases

1. **Core parsing** - `@m2sql/model` and `@m2sql/parser` (in progress)
2. **SQLite compilation** - `@m2sql/sqlite`
3. **Markdown rendering** - `@m2sql/renderer`
4. **Supabase sync** - `@m2sql/supabase`
5. **CLI polish** - `@m2sql/cli` with config file support
6. **Web UI** - `apps/web` with relational visualization

## Tech Stack

- **Language:** TypeScript
- **Monorepo:** pnpm workspaces
- **Markdown parsing:** unified / remark-parse / mdast
- **SQLite:** better-sqlite3
- **Supabase client:** @supabase/supabase-js
- **CLI:** commander
- **Web:** Next.js
- **Config:** JSON (`.pp-trackerrc.json`)
