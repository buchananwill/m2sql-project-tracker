import type { SupabaseClient } from '@supabase/supabase-js';
import type { Table, Row } from '@m2sql/model';

export async function upsertJunctionRows(
  supabase: SupabaseClient,
  table: Table,
  anchorToIdMap: Map<string, number>,
  verbose = false
): Promise<number> {
  let inserted = 0;

  if (verbose) {
    console.log(`Processing ${table.rows.length} junction rows in table ${table.name}`);
  }

  for (const row of table.rows) {
    try {
      const success = await upsertJunctionRow(supabase, table, row, anchorToIdMap);
      if (success) {
        inserted++;
      }
    } catch (error) {
      console.warn(`Failed to upsert junction row: ${error}`);
    }
  }

  return inserted;
}

async function upsertJunctionRow(
  supabase: SupabaseClient,
  table: Table,
  row: Row,
  anchorToIdMap: Map<string, number>
): Promise<boolean> {
  const lhsAnchor = row.columns['_lhs_anchor'] as string;
  const rhsAnchor = row.columns['_rhs_anchor'] as string;

  if (!lhsAnchor || !rhsAnchor) {
    console.warn(`Junction row missing anchor columns: ${JSON.stringify(row.columns)}`);
    return false;
  }

  const lhsId = anchorToIdMap.get(lhsAnchor);
  const rhsId = anchorToIdMap.get(rhsAnchor);

  if (!lhsId || !rhsId) {
    console.warn(`Cannot resolve anchors: ${lhsAnchor} -> ${rhsAnchor}`);
    return false;
  }

  const fkColumns = getForeignKeyColumns(table);
  if (fkColumns.length < 2) {
    console.warn(`Junction table ${table.name} has fewer than 2 FK columns`);
    return false;
  }

  const leftFk = fkColumns[0];
  const rightFk = fkColumns[1];

  if (!leftFk || !rightFk) {
    console.warn(`Missing FK column names in junction table ${table.name}`);
    return false;
  }

  const insertData: Record<string, any> = {};
  insertData[leftFk] = lhsId;
  insertData[rightFk] = rhsId;

  if (row.columns['label']) {
    insertData['label'] = row.columns['label'];
  }

  const { error } = await supabase
    .from(table.name)
    .upsert(insertData, {
      onConflict: `${leftFk},${rightFk}`
    });

  if (error) {
    throw new Error(`Failed to upsert junction row: ${error.message}`);
  }

  return true;
}

function getForeignKeyColumns(table: Table): string[] {
  return table.schema.columns
    .filter(col => col.references)
    .map(col => col.name);
}

export function isJunctionTable(table: Table): boolean {
  const hasLhsAnchor = table.rows.some(row => '_lhs_anchor' in row.columns);
  const hasRhsAnchor = table.rows.some(row => '_rhs_anchor' in row.columns);
  const fkCount = getForeignKeyColumns(table).length;

  return hasLhsAnchor && hasRhsAnchor && fkCount >= 2;
}

export function buildIdToAnchorMap(tables: Table[]): Map<number, string> {
  const map = new Map<number, string>();

  for (const table of tables) {
    if (!isJunctionTable(table)) {
      for (const row of table.rows) {
        if (row.pk !== undefined) {
          map.set(row.pk, row.anchor);
        }
      }
    }
  }

  return map;
}

export function resolveJunctionAnchors(
  row: Record<string, any>,
  fkColumns: string[],
  idToAnchorMap: Map<number, string>
): { _lhs_anchor?: string; _rhs_anchor?: string } {
  if (fkColumns.length < 2) {
    return {};
  }

  const leftCol = fkColumns[0];
  const rightCol = fkColumns[1];

  if (!leftCol || !rightCol) {
    return {};
  }

  const leftId = row[leftCol];
  const rightId = row[rightCol];

  return {
    _lhs_anchor: leftId ? idToAnchorMap.get(leftId) : undefined,
    _rhs_anchor: rightId ? idToAnchorMap.get(rightId) : undefined
  };
}
