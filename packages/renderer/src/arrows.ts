/**
 * Arrow (relationship) rendering for Mermaid classDiagram.
 * Reconstructs arrow declarations from junction table rows.
 */

import type { Table, Row, ArrowMapping } from '@m2sql/model';

export interface RenderedArrow {
  lhsAnchor: string;
  arrowToken: string;
  rhsAnchor: string;
  label?: string;
}

/**
 * Build a map from ID to anchor for all data tables.
 */
function buildIdToAnchorMap(dataTables: Table[]): Map<number, string> {
  const map = new Map<number, string>();

  for (const table of dataTables) {
    for (const row of table.rows) {
      if (row.pk !== undefined) {
        map.set(row.pk, row.anchor);
      }
    }
  }

  return map;
}

/**
 * Extract arrows from junction table rows using arrow mappings.
 * Performs joins to resolve FK IDs to anchors.
 */
export function extractArrows(
  dataTables: Table[],
  junctionTables: Table[],
  arrowMappings: Map<string, ArrowMapping>
): RenderedArrow[] {
  const arrows: RenderedArrow[] = [];
  const idToAnchor = buildIdToAnchorMap(dataTables);

  console.log(`[extractArrows] idToAnchor map size: ${idToAnchor.size}`);
  console.log(`[extractArrows] Processing ${junctionTables.length} junction tables`);

  for (const junctionTable of junctionTables) {
    console.log(`[extractArrows] Junction table: ${junctionTable.name}, rows: ${junctionTable.rows.length}`);
    const mapping = arrowMappings.get(junctionTable.name);
    if (!mapping) {
      console.log(`[extractArrows] No mapping found for ${junctionTable.name}`);
      continue;
    }
    console.log(`[extractArrows] Mapping: ${mapping.leftColumn} ${mapping.arrowToken} ${mapping.rightColumn}`);

    const { leftColumn, rightColumn, arrowToken } = mapping;

    for (const row of junctionTable.rows) {
      console.log(`[extractArrows]   Row columns:`, row.columns);

      // Try _lhs_anchor/_rhs_anchor first (if present from parser)
      let lhsAnchor = row.columns['_lhs_anchor'] as string | undefined;
      let rhsAnchor = row.columns['_rhs_anchor'] as string | undefined;

      // Otherwise, resolve from FK IDs
      if (!lhsAnchor || !rhsAnchor) {
        const leftId = row.columns[leftColumn] as number | undefined;
        const rightId = row.columns[rightColumn] as number | undefined;

        console.log(`[extractArrows]   leftId=${leftId}, rightId=${rightId}`);

        if (leftId !== undefined) {
          lhsAnchor = idToAnchor.get(leftId);
        }
        if (rightId !== undefined) {
          rhsAnchor = idToAnchor.get(rightId);
        }

        console.log(`[extractArrows]   lhsAnchor=${lhsAnchor}, rhsAnchor=${rhsAnchor}`);
      }

      const label = row.columns['label'] as string | undefined;

      if (lhsAnchor && rhsAnchor) {
        console.log(`[extractArrows]   Adding arrow: ${lhsAnchor} ${arrowToken} ${rhsAnchor}`);
        arrows.push({
          lhsAnchor,
          arrowToken,
          rhsAnchor,
          label,
        });
      } else {
        console.log(`[extractArrows]   Skipping arrow - missing anchors`);
      }
    }
  }

  return arrows;
}

/**
 * Render arrow declarations.
 * Format: LHS arrow RHS [: "label"]
 */
export function renderArrows(arrows: RenderedArrow[]): string {
  const lines: string[] = [];

  for (const arrow of arrows) {
    let line = `${arrow.lhsAnchor} ${arrow.arrowToken} ${arrow.rhsAnchor}`;

    if (arrow.label) {
      line += ` : "${arrow.label}"`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}
