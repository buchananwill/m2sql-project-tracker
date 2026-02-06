-- ============================================================================
-- Supabase Setup for m2sql Web UI
-- ============================================================================
-- Run this script in your Supabase SQL Editor to set up required functions.
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste & Run
-- ============================================================================

-- 1. Function to check if a table exists
-- ============================================================================
CREATE OR REPLACE FUNCTION table_exists(table_name_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = table_name_param
  );
END;
$$;

-- 2. Function to execute arbitrary SQL (for creating tables)
-- ============================================================================
-- WARNING: This is a powerful function. Use with caution.
-- It's needed for dynamic table creation from Mermaid diagrams.
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 3. Function to get all table names
-- ============================================================================
CREATE OR REPLACE FUNCTION get_table_names(exclude_pattern TEXT DEFAULT '(pg_%|information_schema)')
RETURNS TABLE(table_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND NOT t.table_name ~ exclude_pattern
  ORDER BY t.table_name;
END;
$$;

-- 4. Function to get columns for a table
-- ============================================================================
CREATE OR REPLACE FUNCTION get_columns(table_name_param TEXT)
RETURNS TABLE(
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;

-- 5. Function to get primary keys for a table
-- ============================================================================
CREATE OR REPLACE FUNCTION get_primary_keys(table_name_param TEXT)
RETURNS TABLE(column_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT kcu.column_name::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = table_name_param
  ORDER BY kcu.ordinal_position;
END;
$$;

-- 6. Function to get foreign keys for a table
-- ============================================================================
CREATE OR REPLACE FUNCTION get_foreign_keys(table_name_param TEXT)
RETURNS TABLE(
  column_name TEXT,
  referenced_table TEXT,
  referenced_column TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kcu.column_name::TEXT,
    ccu.table_name::TEXT AS referenced_table,
    ccu.column_name::TEXT AS referenced_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = table_name_param;
END;
$$;

-- ============================================================================
-- Verification Queries (Optional - Run to test)
-- ============================================================================

-- Test table_exists function
-- SELECT table_exists('_mermaid_arrow_mappings');

-- Test get_table_names function
-- SELECT * FROM get_table_names();

-- Test get_columns function (replace 'your_table' with actual table name)
-- SELECT * FROM get_columns('your_table');

-- Test get_primary_keys function
-- SELECT * FROM get_primary_keys('your_table');

-- Test get_foreign_keys function
-- SELECT * FROM get_foreign_keys('your_table');

-- ============================================================================
-- Grant Permissions (IMPORTANT)
-- ============================================================================
-- These functions need to be executable by authenticated users

GRANT EXECUTE ON FUNCTION table_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_names(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_primary_keys(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_foreign_keys(TEXT) TO authenticated;

-- Also grant to anon for API access
GRANT EXECUTE ON FUNCTION table_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_table_names(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_columns(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_primary_keys(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_foreign_keys(TEXT) TO anon;

-- ============================================================================
-- Success!
-- ============================================================================
-- All functions created successfully.
-- You can now use the m2sql web UI to push/pull data.
-- ============================================================================
