/**
 * Arrow mapping inference from junction table schemas.
 * Reconstructs arrow-to-junction-table mappings for rendering.
 */

import type { Table, TableSchema, ColumnDefinition } from '@m2sql/model';

export interface InferredArrowMapping {
  /** Left FK column name */
  leftColumn: string;
  /** Arrow token (e.g., "*--", "..>") */
  arrowToken: string;
  /** Right FK column name */
  rightColumn: string;
  /** Junction table name */
  junctionTable: string;
  /** Left table name */
  leftTable: string;
  /** Right table name */
  rightTable: string;
}

/**
 * Identify if a table is a junction table.
 * Junction tables have exactly 2 FK columns that form the primary key.
 */
function isJunctionTable(schema: TableSchema): boolean {
  const fkColumns = schema.columns.filter(c => c.references !== undefined);

  if (fkColumns.length < 2) return false;

  // Check if the first two FKs are part of the primary key
  const pkSet = new Set(schema.primaryKey);
  const fkInPk = fkColumns.filter(fk => pkSet.has(fk.name));

  return fkInPk.length >= 2;
}

/**
 * Infer arrow token from FK column names and table semantics.
 * Uses common naming conventions to guess relationship type.
 */
function inferArrowToken(
  leftCol: ColumnDefinition,
  rightCol: ColumnDefinition,
  junctionTableName: string
): string {
  const leftName = leftCol.name.toLowerCase();
  const rightName = rightCol.name.toLowerCase();
  const tableName = junctionTableName.toLowerCase();

  // Composition: parent/child pattern
  if (
    (leftName.includes('parent') && rightName.includes('child')) ||
    tableName.includes('part_of') ||
    tableName.includes('composed_of')
  ) {
    return '*--';
  }

  // Dependency: dependent/prerequisite pattern
  if (
    (leftName.includes('dependent') && rightName.includes('prerequisite')) ||
    (leftName.includes('blocked') && rightName.includes('blocker')) ||
    tableName.includes('depends_on') ||
    tableName.includes('requires')
  ) {
    return '..>';
  }

  // Aggregation: container/item pattern
  if (
    (leftName.includes('container') && rightName.includes('item')) ||
    (leftName.includes('group') && rightName.includes('member'))
  ) {
    return 'o--';
  }

  // Association (default)
  return '-->';
}

/**
 * Infer arrow mappings from junction tables in a database.
 * Returns a map of junction table name to arrow mapping.
 */
export function inferArrowMappings(
  tables: Table[]
): Map<string, InferredArrowMapping> {
  const mappings = new Map<string, InferredArrowMapping>();

  for (const table of tables) {
    if (!isJunctionTable(table.schema)) continue;

    const fkColumns = table.schema.columns.filter(c => c.references !== undefined);
    if (fkColumns.length < 2) continue;

    // Sort FK columns by name to ensure consistent ordering
    const sortedFkColumns = [...fkColumns].sort((a, b) => a.name.localeCompare(b.name));

    // Use first two FK columns (after sorting)
    const leftCol = sortedFkColumns[0]!;
    const rightCol = sortedFkColumns[1]!;

    const leftTable = leftCol.references!.table;
    const rightTable = rightCol.references!.table;

    const arrowToken = inferArrowToken(leftCol, rightCol, table.name);

    mappings.set(table.name, {
      leftColumn: leftCol.name,
      arrowToken,
      rightColumn: rightCol.name,
      junctionTable: table.name,
      leftTable,
      rightTable,
    });
  }

  return mappings;
}

/**
 * Format arrow mapping as a comment line for Mermaid header.
 * Format: %% left_column arrow_token right_column : junction_table
 */
export function formatArrowMapping(mapping: InferredArrowMapping): string {
  return `%% ${mapping.leftColumn} ${mapping.arrowToken} ${mapping.rightColumn} : ${mapping.junctionTable}`;
}
