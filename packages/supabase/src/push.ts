import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@m2sql/model';
import type { PushOptions, PushResult } from './types.js';
import { createTable, tableExists } from './schema.js';
import { upsertDataRows } from './upsert.js';
import { isJunctionTable, upsertJunctionRows } from './junction.js';
import { pushMetadata } from './metadata.js';

export async function pushToSupabase(
  database: Database,
  supabase: SupabaseClient,
  options: PushOptions = {}
): Promise<PushResult> {
  const { verbose = false } = options;
  const result: PushResult = {
    tablesCreated: 0,
    tablesUpdated: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    warnings: [],
    errors: []
  };

  const anchorToIdMap = new Map<string, number>();

  try {
    if (verbose) {
      console.log(`Pushing database "${database.name}" to Supabase`);
    }

    const dataTables = database.tables.filter(t => !isJunctionTable(t));
    const junctionTables = database.tables.filter(t => isJunctionTable(t));

    if (verbose) {
      console.log(`Found ${dataTables.length} data tables and ${junctionTables.length} junction tables`);
    }

    for (const table of database.tables) {
      try {
        const exists = await tableExists(supabase, table.name);
        if (!exists) {
          await createTable(supabase, table, verbose);
          result.tablesCreated++;
        } else {
          result.tablesUpdated++;
          if (verbose) {
            console.log(`Table ${table.name} already exists`);
          }
        }
      } catch (error) {
        const message = `Failed to create table ${table.name}: ${error}`;
        result.errors.push(message);
        console.error(message);
      }
    }

    for (const table of dataTables) {
      try {
        const { inserted, updated } = await upsertDataRows(
          supabase,
          table,
          anchorToIdMap,
          verbose
        );
        result.rowsInserted += inserted;
        result.rowsUpdated += updated;
      } catch (error) {
        const message = `Failed to upsert data rows in ${table.name}: ${error}`;
        result.errors.push(message);
        console.error(message);
      }
    }

    for (const table of junctionTables) {
      try {
        const inserted = await upsertJunctionRows(
          supabase,
          table,
          anchorToIdMap,
          verbose
        );
        result.rowsInserted += inserted;
      } catch (error) {
        const message = `Failed to upsert junction rows in ${table.name}: ${error}`;
        result.errors.push(message);
        console.error(message);
      }
    }

    if (database.arrowMappings && database.arrowMappings.length > 0) {
      try {
        await pushMetadata(supabase, database.arrowMappings, verbose);
      } catch (error) {
        const message = `Failed to sync metadata: ${error}`;
        result.warnings.push(message);
        console.warn(message);
      }
    }

    if (verbose) {
      console.log('\nPush complete:');
      console.log(`  Tables created: ${result.tablesCreated}`);
      console.log(`  Tables updated: ${result.tablesUpdated}`);
      console.log(`  Rows inserted: ${result.rowsInserted}`);
      console.log(`  Rows updated: ${result.rowsUpdated}`);
      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.length}`);
      }
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Push failed: ${error}`);
    throw error;
  }
}
