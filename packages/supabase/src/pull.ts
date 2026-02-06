import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Table, Row, ArrowMapping } from '@m2sql/model';
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

  // Step 1: Pull metadata FIRST to know which tables are junction tables
  const arrowMappings = await pullMetadata(supabase, verbose);
  const junctionTableNamesFromMetadata = new Set(
    arrowMappings.map(m => m.junctionTable)
  );

  if (verbose && arrowMappings.length > 0) {
    console.log(`Found ${arrowMappings.length} arrow mappings for junction tables:`,
      Array.from(junctionTableNamesFromMetadata));
  }

  // Step 2: Get all table names and schemas
  const tableNames = await getTableNames(supabase, excludePattern);

  if (verbose) {
    console.log(`Found ${tableNames.length} tables`);
  }

  const tableSchemas = new Map<string, any>();
  for (const tableName of tableNames) {
    const schema = await getTableSchema(supabase, tableName);
    tableSchemas.set(tableName, schema);
  }

  // Step 3: Separate based on metadata (preferred) or schema fallback
  const dataTables = tableNames.filter(name => {
    // If we have metadata, use it to identify junction tables
    if (junctionTableNamesFromMetadata.size > 0) {
      return !junctionTableNamesFromMetadata.has(name);
    }
    // Fallback to schema-based detection
    const schema = tableSchemas.get(name);
    return !isJunctionTable(schema);
  });

  const junctionTableNames = tableNames.filter(name => {
    // If we have metadata, use it
    if (junctionTableNamesFromMetadata.size > 0) {
      return junctionTableNamesFromMetadata.has(name);
    }
    // Fallback to schema-based detection
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

    // Find arrow mapping for this junction table
    const arrowMapping = arrowMappings.find(m => m.junctionTable === tableName);

    const rows = await fetchJunctionRows(
      supabase,
      tableName,
      schema,
      idToAnchorMap,
      arrowMapping,
      verbose
    );

    tables.push({
      name: tableName,
      schema: buildTableSchemaFromSupabase(schema),
      rawSql: buildRawSqlFromSchema(tableName, schema),
      rows
    });
  }

  // Metadata was already pulled at the beginning
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
  arrowMapping: { leftColumn: string; rightColumn: string } | undefined,
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

  // Use arrow mapping to get FK columns (preferred) or fall back to schema
  let fkColumns: string[];
  if (arrowMapping) {
    fkColumns = [arrowMapping.leftColumn, arrowMapping.rightColumn];
    if (verbose) {
      console.log(`  Using arrow mapping for FK columns: [${fkColumns.join(', ')}]`);
    }
  } else {
    fkColumns = schema.foreignKeys.map((fk: any) => fk.columnName);
    if (verbose && fkColumns.length === 0) {
      console.warn(`  ⚠ No FK columns found in schema or arrow mapping for ${tableName}`);
    }
  }

  return (data || []).map((row: any, index: number) => {
    const anchors = resolveJunctionAnchors(row, fkColumns, idToAnchorMap);
    const { label, ...otherColumns } = row;

    // Debug: check if anchors were resolved
    if (verbose && (!anchors._lhs_anchor || !anchors._rhs_anchor)) {
      console.warn(`  ⚠ Could not resolve anchors for junction row in ${tableName}:`,
        `FK columns: [${fkColumns.join(', ')}]`,
        `Values: [${fkColumns.map((col: string) => row[col]).join(', ')}]`);
    }

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
