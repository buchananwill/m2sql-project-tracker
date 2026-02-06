import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Table, Row } from '@m2sql/model';
import type { PullOptions } from './types.js';
import {
  getTableNames,
  getTableSchema,
  isJunctionTable,
  buildTableSchemaFromSupabase,
  buildRawSqlFromSchema
} from './schema.js';
import { resolveJunctionAnchors } from './junction.js';
import { pullMetadata } from './metadata.js';

export async function pullFromSupabase(
  supabase: SupabaseClient,
  databaseName: string,
  options: PullOptions = {}
): Promise<Database> {
  const { verbose = false, excludePattern = '(pg_%|information_schema|_mermaid_%)' } = options;

  if (verbose) {
    console.log(`Pulling database "${databaseName}" from Supabase`);
  }

  const tableNames = await getTableNames(supabase, excludePattern);

  if (verbose) {
    console.log(`Found ${tableNames.length} tables`);
  }

  const tableSchemas = new Map<string, any>();
  for (const tableName of tableNames) {
    const schema = await getTableSchema(supabase, tableName);
    tableSchemas.set(tableName, schema);
  }

  const dataTables = tableNames.filter(name => {
    const schema = tableSchemas.get(name);
    return !isJunctionTable(schema);
  });

  const junctionTableNames = tableNames.filter(name => {
    const schema = tableSchemas.get(name);
    return isJunctionTable(schema);
  });

  if (verbose) {
    console.log(`Identified ${dataTables.length} data tables and ${junctionTableNames.length} junction tables`);
  }

  const idToAnchorMap = new Map<number, string>();

  const tables: Table[] = [];

  for (const tableName of dataTables) {
    const schema = tableSchemas.get(tableName);
    const rows = await fetchDataRows(supabase, tableName, idToAnchorMap, verbose);

    tables.push({
      name: tableName,
      schema: buildTableSchemaFromSupabase(schema),
      rawSql: buildRawSqlFromSchema(tableName, schema),
      rows
    });
  }

  for (const tableName of junctionTableNames) {
    const schema = tableSchemas.get(tableName);
    const rows = await fetchJunctionRows(supabase, tableName, schema, idToAnchorMap, verbose);

    tables.push({
      name: tableName,
      schema: buildTableSchemaFromSupabase(schema),
      rawSql: buildRawSqlFromSchema(tableName, schema),
      rows
    });
  }

  const arrowMappings = await pullMetadata(supabase, verbose);

  return {
    name: databaseName,
    anchor: `db_${databaseName}`,
    tables,
    arrowMappings: arrowMappings.length > 0 ? arrowMappings : undefined
  };
}

async function fetchDataRows(
  supabase: SupabaseClient,
  tableName: string,
  idToAnchorMap: Map<number, string>,
  verbose: boolean
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch rows from ${tableName}: ${error.message}`);
  }

  if (verbose && data) {
    console.log(`  Fetched ${data.length} rows from ${tableName}`);
  }

  return (data || []).map((row: any) => {
    const { id, name, anchor, ...columns } = row;

    if (id && anchor) {
      idToAnchorMap.set(id, anchor);
    }

    return {
      name: name || `${tableName}_${id}`,
      anchor: anchor || `${tableName}_${id}`,
      pk: id,
      columns,
      relationships: {}
    };
  });
}

async function fetchJunctionRows(
  supabase: SupabaseClient,
  tableName: string,
  schema: any,
  idToAnchorMap: Map<number, string>,
  verbose: boolean
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch junction rows from ${tableName}: ${error.message}`);
  }

  if (verbose && data) {
    console.log(`  Fetched ${data.length} junction rows from ${tableName}`);
  }

  const fkColumns = schema.foreignKeys.map((fk: any) => fk.columnName);

  return (data || []).map((row: any, index: number) => {
    const anchors = resolveJunctionAnchors(row, fkColumns, idToAnchorMap);
    const { label, ...otherColumns } = row;

    const columns: Record<string, any> = {
      ...anchors,
      ...otherColumns
    };

    if (label !== undefined) {
      columns['label'] = label;
    }

    return {
      name: `${tableName}_${index}`,
      anchor: `${tableName}_${index}`,
      columns,
      relationships: {}
    };
  });
}
