import type { SupabaseClient } from '@supabase/supabase-js';
import type { Table, Row } from '@m2sql/model';
import { buildRowData } from '@m2sql/model';
import type { UpsertResult } from './types.js';

export async function upsertRow(
  supabase: SupabaseClient,
  table: Table,
  row: Row,
  anchorToIdMap: Map<string, number>
): Promise<UpsertResult> {
  const rowData = buildRowData(row);

  // Step 1: Try match by explicit id
  if (row.pk !== undefined) {
    const { data: existing, error } = await supabase
      .from(table.name)
      .select('*')
      .eq('id', row.pk)
      .maybeSingle();

    if (!error && existing) {
      // UPDATE existing row
      await supabase
        .from(table.name)
        .update(rowData)
        .eq('id', row.pk);

      anchorToIdMap.set(row.anchor, row.pk);
      return { action: 'updated', id: row.pk };
    }
  }

  // Step 2: Try match by name
  if (row.name) {
    const { data: existingByName, error } = await supabase
      .from(table.name)
      .select('*')
      .eq('name', row.name)
      .maybeSingle();

    if (!error && existingByName) {
      // UPDATE existing row
      const id = existingByName.id;
      await supabase
        .from(table.name)
        .update(rowData)
        .eq('id', id);

      anchorToIdMap.set(row.anchor, id);
      return { action: 'updated', id };
    }
  }

  // Step 3: INSERT new row
  const { data: inserted, error: insertError } = await supabase
    .from(table.name)
    .insert(rowData)
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to insert row in ${table.name}: ${insertError.message}`);
  }

  const newId = inserted.id;
  anchorToIdMap.set(row.anchor, newId);
  return { action: 'inserted', id: newId };
}

export async function upsertDataRows(
  supabase: SupabaseClient,
  table: Table,
  anchorToIdMap: Map<string, number>,
  verbose = false
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  if (verbose) {
    console.log(`Upserting ${table.rows.length} rows in table ${table.name}`);
  }

  for (const row of table.rows) {
    const result = await upsertRow(supabase, table, row, anchorToIdMap);
    if (result.action === 'inserted') {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}
