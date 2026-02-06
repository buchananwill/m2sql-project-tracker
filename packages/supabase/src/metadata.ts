import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArrowMapping } from '@m2sql/model';

const METADATA_TABLE = '_mermaid_arrow_mappings';

const CREATE_METADATA_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${METADATA_TABLE} (
  id SERIAL PRIMARY KEY,
  junction_table TEXT NOT NULL,
  left_column TEXT NOT NULL,
  arrow_token TEXT NOT NULL,
  right_column TEXT NOT NULL,
  UNIQUE (junction_table, left_column, right_column)
);
`;

export async function createMetadataTable(
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.rpc('exec_sql', {
    sql: CREATE_METADATA_TABLE_SQL
  });

  if (error) {
    throw new Error(`Failed to create metadata table: ${error.message}`);
  }
}

export async function pushMetadata(
  supabase: SupabaseClient,
  arrowMappings: ArrowMapping[],
  verbose = false
): Promise<void> {
  if (verbose) {
    console.log(`Syncing ${arrowMappings.length} arrow mappings to metadata table`);
  }

  await createMetadataTable(supabase);

  const { error: deleteError } = await supabase
    .from(METADATA_TABLE)
    .delete()
    .neq('junction_table', '');

  if (deleteError) {
    console.warn(`Could not clear metadata table: ${deleteError.message}`);
  }

  if (arrowMappings.length === 0) {
    return;
  }

  const rows = arrowMappings.map(m => ({
    junction_table: m.junctionTable,
    left_column: m.leftColumn,
    arrow_token: m.arrowToken,
    right_column: m.rightColumn
  }));

  const { error: insertError } = await supabase
    .from(METADATA_TABLE)
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert metadata: ${insertError.message}`);
  }
}

export async function pullMetadata(
  supabase: SupabaseClient,
  verbose = false
): Promise<ArrowMapping[]> {
  if (verbose) {
    console.log('Reading arrow mappings from metadata table');
  }

  const { data, error } = await supabase
    .from(METADATA_TABLE)
    .select('*');

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      if (verbose) {
        console.log('Metadata table does not exist, returning empty mappings');
      }
      return [];
    }
    throw new Error(`Failed to read metadata: ${error.message}`);
  }

  return data?.map(row => ({
    junctionTable: row.junction_table,
    leftColumn: row.left_column,
    arrowToken: row.arrow_token,
    rightColumn: row.right_column
  })) || [];
}
