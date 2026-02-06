# @m2sql/supabase

Supabase integration for m2sql project tracker. Enables pushing and pulling databases between the m2sql Database model and Supabase PostgreSQL.

## Architecture

The m2sql project uses a **hub-and-spoke architecture** with the Database model as the central interchange format:

```
              ┌─────────────────────┐
              │   Database Model    │
              │  (in-memory AST)    │
              │  TypeScript object  │
              └─────────────────────┘
                 /       |         \
                /        |          \
               /         |           \
        Mermaid      SQLite        Supabase
        (.mmd)    (binary .db)     (cloud)
         ↕            ↕               ↕
      Parser/      Compile/        Push/Pull
      Renderer     Extract         (this pkg)
```

## API

### pushToSupabase()

Push a Database model to Supabase:

```typescript
import { pushToSupabase } from '@m2sql/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
const result = await pushToSupabase(database, supabase, { verbose: true });

console.log(`Created ${result.tablesCreated} tables`);
console.log(`Inserted ${result.rowsInserted} rows`);
```

**UPSERT Logic:**
1. Match by explicit id (row.pk)
2. Match by name
3. Insert new

### pullFromSupabase()

Pull a Database model from Supabase:

```typescript
import { pullFromSupabase } from '@m2sql/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
const database = await pullFromSupabase(supabase, 'mydb', { verbose: true });

console.log(`Pulled ${database.tables.length} tables`);
```

## Supabase Setup

Your Supabase project needs these RPC functions for DDL operations:

```sql
-- Execute arbitrary SQL (for CREATE TABLE)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get table names
CREATE OR REPLACE FUNCTION get_table_names(exclude_pattern TEXT)
RETURNS TABLE(table_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name NOT SIMILAR TO exclude_pattern;
END;
$$ LANGUAGE plpgsql;
```

Run these in your Supabase SQL editor to enable DDL operations.

## Metadata Table

The package creates a `_mermaid_arrow_mappings` table to store arrow token mappings for lossless round-trips:

```sql
CREATE TABLE _mermaid_arrow_mappings (
  id SERIAL PRIMARY KEY,
  junction_table TEXT NOT NULL,
  left_column TEXT NOT NULL,
  arrow_token TEXT NOT NULL,
  right_column TEXT NOT NULL,
  UNIQUE (junction_table, left_column, right_column)
);
```

This table is created automatically during push operations.

## Junction Table Handling

Junction tables are automatically detected and handled:

- **Data tables**: Tables with regular rows
- **Junction tables**: Tables with `_lhs_anchor` and `_rhs_anchor` columns

During push, junction tables are processed after data tables to ensure foreign key relationships are resolved correctly.

## CLI Usage

See the main CLI package for command-line usage:

```bash
# Push to Supabase
m2sql push project.mmd --url <url> --key <key>

# Pull from Supabase
m2sql pull -o output.mmd --url <url> --key <key>

# Sync SQLite to Supabase
m2sql sync project.db --url <url> --key <key>
```

## Type Safety

All functions are fully typed with TypeScript. See `src/types.ts` for the full type definitions.
