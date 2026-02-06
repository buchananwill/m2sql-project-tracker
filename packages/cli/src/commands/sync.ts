/**
 * Sync command: Extract from SQLite and push to Supabase
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { extractFromDb } from '@m2sql/sqlite';
import { pushToSupabase } from '@m2sql/supabase';
import initSqlJs from 'sql.js';

export interface SyncOptions {
  input: string;
  url?: string;
  key?: string;
  verbose?: boolean;
}

export async function sync(options: SyncOptions): Promise<void> {
  const { input, verbose } = options;

  try {
    const supabaseUrl = options.url || process.env['SUPABASE_URL'];
    const supabaseKey = options.key || process.env['SUPABASE_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase URL and key are required');
      console.error('Provide via --url and --key flags or SUPABASE_URL and SUPABASE_KEY environment variables');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const inputPath = resolve(input);
    if (verbose) {
      console.log(`Reading SQLite database: ${inputPath}`);
    }

    const SQL = await initSqlJs();
    const buffer = readFileSync(inputPath);
    const db = new SQL.Database(buffer);

    if (verbose) {
      console.log('Extracting database model from SQLite...');
    }

    const database = extractFromDb(db, 'database');

    if (verbose) {
      console.log(`\nExtracted database "${database.name}"`);
      console.log(`Tables: ${database.tables.length}`);
      for (const table of database.tables) {
        console.log(`  - ${table.name}: ${table.rows.length} rows`);
      }
    }

    if (verbose) {
      console.log(`\nPushing to Supabase...`);
    }

    const result = await pushToSupabase(database, supabase, { verbose });

    db.close();

    console.log('\n✓ Sync complete:');
    console.log(`  Tables created: ${result.tablesCreated}`);
    console.log(`  Tables updated: ${result.tablesUpdated}`);
    console.log(`  Rows inserted: ${result.rowsInserted}`);
    console.log(`  Rows updated: ${result.rowsUpdated}`);

    if (result.warnings.length > 0) {
      console.warn(`\nWarnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        console.warn(`  ⚠ ${warning}`);
      }
    }

    if (result.errors.length > 0) {
      console.error(`\nErrors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.error(`  ✗ ${error}`);
      }
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}
