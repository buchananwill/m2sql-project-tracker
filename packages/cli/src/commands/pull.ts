/**
 * Pull command: Download database from Supabase and render to Mermaid
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { pullFromSupabase } from '@m2sql/supabase';
import { renderToMermaid } from '@m2sql/renderer';

export interface PullOptions {
  output: string;
  url?: string;
  key?: string;
  database?: string;
  verbose?: boolean;
}

export async function pull(options: PullOptions): Promise<void> {
  const { output, verbose } = options;

  try {
    const supabaseUrl = options.url || process.env['SUPABASE_URL'];
    const supabaseKey = options.key || process.env['SUPABASE_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Supabase URL and key are required');
      console.error('Provide via --url and --key flags or SUPABASE_URL and SUPABASE_KEY environment variables');
      process.exit(1);
    }

    const databaseName = options.database || 'database';
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (verbose) {
      console.log(`Pulling database "${databaseName}" from Supabase...`);
    }

    const database = await pullFromSupabase(supabase, databaseName, { verbose });

    if (verbose) {
      console.log(`\nPulled ${database.tables.length} tables`);
      for (const table of database.tables) {
        console.log(`  - ${table.name}: ${table.rows.length} rows`);
      }
    }

    if (verbose) {
      console.log('\nRendering to Mermaid...');
    }

    const result = renderToMermaid(database);

    if (result.warnings.length > 0 && verbose) {
      console.warn('\nRender warnings:');
      for (const warning of result.warnings) {
        console.warn(`  ⚠ ${warning.message}`);
      }
    }

    const outputPath = resolve(output);
    writeFileSync(outputPath, result.mermaid, 'utf-8');

    console.log(`✓ Database pulled and saved: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}
