-- Supabase Setup for m2sql
-- Run these commands in your Supabase SQL Editor to enable m2sql integration

-- 1. Function to execute arbitrary SQL (needed for CREATE TABLE operations)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = table_name_param
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to get table names with pattern exclusion
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

-- 4. Function to get column information for a table
CREATE OR REPLACE FUNCTION get_columns(table_name_param TEXT)
RETURNS TABLE(
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT,
  ordinal_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT,
    c.ordinal_position::INTEGER
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get primary key columns for a table
CREATE OR REPLACE FUNCTION get_primary_keys(table_name_param TEXT)
RETURNS TABLE(column_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT kcu.column_name::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = table_name_param
    AND tc.constraint_type = 'PRIMARY KEY';
END;
$$ LANGUAGE plpgsql;

-- 6. Function to get foreign key information for a table
CREATE OR REPLACE FUNCTION get_foreign_keys(table_name_param TEXT)
RETURNS TABLE(
  column_name TEXT,
  referenced_table TEXT,
  referenced_column TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kcu.column_name::TEXT,
    ccu.table_name::TEXT AS referenced_table,
    ccu.column_name::TEXT AS referenced_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = table_name_param;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant necessary permissions
-- If using anon key, adjust RLS policies as needed
-- For service role key, these permissions are automatically available

-- Success!
-- You can now use m2sql push, pull, and sync commands with this Supabase project
