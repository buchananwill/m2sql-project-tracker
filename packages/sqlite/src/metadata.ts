/**
 * Mermaid metadata storage for lossless round-trip.
 * Stores arrow mappings to preserve exact Mermaid syntax.
 */

import type { Database as SqlJsDatabase } from 'sql.js';

export interface ArrowMappingMetadata {
  junctionTable: string;
  leftColumn: string;
  arrowToken: string;
  rightColumn: string;
}

/**
 * Create the metadata table for storing arrow mappings.
 */
export function createMetadataTable(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _mermaid_arrow_mappings (
      junction_table TEXT PRIMARY KEY,
      left_column TEXT NOT NULL,
      arrow_token TEXT NOT NULL,
      right_column TEXT NOT NULL
    )
  `);
}

/**
 * Insert arrow mapping metadata for a junction table.
 */
export function insertArrowMapping(
  db: SqlJsDatabase,
  mapping: ArrowMappingMetadata
): void {
  db.run(
    `INSERT OR REPLACE INTO _mermaid_arrow_mappings
     (junction_table, left_column, arrow_token, right_column)
     VALUES (?, ?, ?, ?)`,
    [mapping.junctionTable, mapping.leftColumn, mapping.arrowToken, mapping.rightColumn]
  );
}

/**
 * Read all arrow mappings from the metadata table.
 * Returns empty array if table doesn't exist.
 */
export function readArrowMappings(db: SqlJsDatabase): ArrowMappingMetadata[] {
  try {
    const result = db.exec(`SELECT * FROM _mermaid_arrow_mappings`);

    if (result.length === 0) return [];

    const { columns, values } = result[0]!;
    const junctionTableIdx = columns.indexOf('junction_table');
    const leftColumnIdx = columns.indexOf('left_column');
    const arrowTokenIdx = columns.indexOf('arrow_token');
    const rightColumnIdx = columns.indexOf('right_column');

    return values.map(row => ({
      junctionTable: row[junctionTableIdx] as string,
      leftColumn: row[leftColumnIdx] as string,
      arrowToken: row[arrowTokenIdx] as string,
      rightColumn: row[rightColumnIdx] as string,
    }));
  } catch {
    // Table doesn't exist
    return [];
  }
}
