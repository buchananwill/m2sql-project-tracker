/**
 * Main rendering orchestration for Database model to Mermaid format.
 */

import type { Database, Table, ArrowMapping } from '@m2sql/model';
import { renderFrontmatter } from './frontmatter.js';
import { renderSqlHeader } from './sql-header.js';
import { formatArrowMapping } from './arrow-mappings.js';
import { orderRows } from './ordering.js';
import { renderNamespace, renderClassDefs } from './namespace.js';
import { extractArrows, renderArrows } from './arrows.js';

export interface RenderWarning {
  message: string;
}

export interface RenderResult {
  mermaid: string;
  warnings: RenderWarning[];
}

export interface RenderOptions {
  /** Include classDef style declarations (default: true) */
  includeStyles?: boolean;
  /** Sort tables alphabetically (default: false - preserve order) */
  sortTables?: boolean;
  /** Require arrow mapping metadata (default: true) */
  requireMetadata?: boolean;
}

/**
 * Separate data tables from junction tables.
 */
function separateTables(tables: Table[]): {
  dataTables: Table[];
  junctionTables: Table[];
} {
  const dataTables: Table[] = [];
  const junctionTables: Table[] = [];

  for (const table of tables) {
    // Check if table has _lhs_anchor and _rhs_anchor columns (junction table marker)
    const hasJunctionMarkers = table.rows.some(
      row =>
        row.columns['_lhs_anchor'] !== undefined &&
        row.columns['_rhs_anchor'] !== undefined
    );

    // Also check schema - junction tables have 2+ FK columns forming PK
    const fkColumns = table.schema.columns.filter(c => c.references !== undefined);
    const pkSet = new Set(table.schema.primaryKey);
    const fkInPk = fkColumns.filter(fk => pkSet.has(fk.name));
    const isJunctionBySchema = fkInPk.length >= 2;

    if (hasJunctionMarkers || isJunctionBySchema) {
      junctionTables.push(table);
    } else {
      dataTables.push(table);
    }
  }

  return { dataTables, junctionTables };
}

/**
 * Render a Database model to Mermaid .mmd format.
 *
 * Output structure:
 * 1. YAML frontmatter (title, config)
 * 2. SQL header (CREATE TABLE statements)
 * 3. Arrow mappings
 * 4. classDiagram declaration
 * 5. Namespace blocks (data tables with rows)
 * 6. Arrow declarations (relationships)
 * 7. classDef style declarations (optional)
 *
 * Returns result with warnings if arrow mappings are missing.
 */
export function renderToMermaid(
  database: Database,
  options: RenderOptions = {}
): RenderResult {
  const { includeStyles = true, sortTables = false, requireMetadata = true } = options;
  const warnings: RenderWarning[] = [];

  const sections: string[] = [];

  // 1. Frontmatter
  sections.push(renderFrontmatter(database.name));
  sections.push(''); // Blank line

  // Separate data tables from junction tables
  const { dataTables, junctionTables } = separateTables(database.tables);

  // Sort tables if requested
  const orderedDataTables = sortTables
    ? [...dataTables].sort((a, b) => a.name.localeCompare(b.name))
    : dataTables;

  const orderedJunctionTables = sortTables
    ? [...junctionTables].sort((a, b) => a.name.localeCompare(b.name))
    : junctionTables;

  const allTablesOrdered = [...orderedDataTables, ...orderedJunctionTables];

  // 2. SQL Header (CREATE TABLE statements)
  const sqlHeader = renderSqlHeader(allTablesOrdered);
  sections.push(sqlHeader);
  sections.push('%%'); // Separator

  // 3. Arrow mappings (from metadata, not inferred)
  const arrowMappings = new Map<string, ArrowMapping>();

  if (database.arrowMappings && database.arrowMappings.length > 0) {
    for (const mapping of database.arrowMappings) {
      sections.push(formatArrowMapping({
        leftColumn: mapping.leftColumn,
        arrowToken: mapping.arrowToken,
        rightColumn: mapping.rightColumn,
        junctionTable: mapping.junctionTable,
        leftTable: '', // Not needed for formatting
        rightTable: '', // Not needed for formatting
      }));
      arrowMappings.set(mapping.junctionTable, mapping);
    }
  } else if (requireMetadata && orderedJunctionTables.length > 0) {
    warnings.push({
      message: 'Missing arrow mapping metadata - relationship arrows will be omitted. Database may not have been created with metadata support.',
    });
  }

  sections.push(''); // Blank line

  // 4. classDiagram declaration
  sections.push('classDiagram');
  sections.push(''); // Blank line

  // 5. Namespace blocks (order rows within each table)
  const orderedRowsByTable = orderRows(
    orderedDataTables,
    orderedJunctionTables,
    arrowMappings
  );

  for (const table of orderedDataTables) {
    const rows = orderedRowsByTable.get(table.name) || [];

    if (rows.length === 0) {
      // Empty namespace - still render it
      sections.push(`namespace ${table.name} {`);
      sections.push('}');
    } else {
      sections.push(renderNamespace(table.name, rows));
    }

    sections.push(''); // Blank line between namespaces
  }

  // 6. Arrow declarations (resolve FK IDs to anchors via joins)
  // Only render if we have metadata
  if (arrowMappings.size > 0) {
    const arrows = extractArrows(orderedDataTables, orderedJunctionTables, arrowMappings);
    if (arrows.length > 0) {
      sections.push(renderArrows(arrows));
      sections.push(''); // Blank line
    }
  }

  // 7. classDef style declarations
  if (includeStyles) {
    const tableNames = orderedDataTables.map(t => t.name);
    sections.push(renderClassDefs(tableNames));
  }

  // Join all sections and return with warnings
  return {
    mermaid: sections.join('\n'),
    warnings,
  };
}
