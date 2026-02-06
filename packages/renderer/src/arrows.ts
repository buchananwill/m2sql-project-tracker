/**
 * Arrow (relationship) rendering for Mermaid classDiagram.
 * Reconstructs arrow declarations from junction table rows.
 */

import type { Table, Row, ArrowMapping } from '@m2sql/model';
import { buildIdToAnchorMap } from '@m2sql/model';

export interface RenderedArrow {
  lhsAnchor: string;
  arrowToken: string;
  rhsAnchor: string;
  label?: string;
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

  for (const junctionTable of junctionTables) {
    const mapping = arrowMappings.get(junctionTable.name);
    if (!mapping) {
      continue;
    }

    const { leftColumn, rightColumn, arrowToken } = mapping;

    for (const row of junctionTable.rows) {
      // Try _lhs_anchor/_rhs_anchor first (if present from parser)
      let lhsAnchor = row.columns['_lhs_anchor'] as string | undefined;
      let rhsAnchor = row.columns['_rhs_anchor'] as string | undefined;

      // Otherwise, resolve from FK IDs
      if (!lhsAnchor || !rhsAnchor) {
        const leftId = row.columns[leftColumn] as number | undefined;
        const rightId = row.columns[rightColumn] as number | undefined;

        if (leftId !== undefined) {
          lhsAnchor = idToAnchor.get(leftId);
        }
        if (rightId !== undefined) {
          rhsAnchor = idToAnchor.get(rightId);
        }
      }

      const label = row.columns['label'] as string | undefined;

      if (lhsAnchor && rhsAnchor) {
        arrows.push({
          lhsAnchor,
          arrowToken,
          rhsAnchor,
          label,
        });
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
