/**
 * Push command: Upload database to Supabase
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMermaid, validateModel } from '@m2sql/parser';
import { createClient } from '@supabase/supabase-js';
import { pushToSupabase } from '@m2sql/supabase';

export interface PushOptions {
  input: string;
  url?: string;
  key?: string;
  verbose?: boolean;
}

export async function push(options: PushOptions): Promise<void> {
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
      console.log(`Reading: ${inputPath}`);
    }

    const content = readFileSync(inputPath, 'utf-8');

    if (verbose) {
      console.log('Parsing mermaid...');
    }

    const parseResult = parseMermaid(content);

    if (parseResult.errors.length > 0) {
      console.error('Parse errors:');
      for (const error of parseResult.errors) {
        console.error(`  ✗ ${error.message}`);
      }
      process.exit(1);
    }

    if (parseResult.warnings.length > 0 && verbose) {
      console.warn('Warnings:');
      for (const warning of parseResult.warnings) {
        console.warn(`  ⚠ ${warning.message}`);
      }
    }

    const validation = validateModel(parseResult.databases);
    if (!validation.valid) {
      console.error('Validation errors:');
      for (const error of validation.errors) {
        console.error(`  ✗ [${error.type}] ${error.message}`);
      }
      process.exit(1);
    }

    const database = parseResult.databases[0];
    if (!database) {
      console.error('No database found in input file');
      process.exit(1);
    }

    if (verbose) {
      console.log(`\nPushing database "${database.name}" to Supabase...`);
    }

    const result = await pushToSupabase(database, supabase, { verbose });

    console.log('\n✓ Push complete:');
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
