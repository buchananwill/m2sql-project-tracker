/**
 * Data-driven node sizing computation.
 * Extracts the sizing logic from TaskNode into a testable pure function.
 *
 * The effective rendered size of a node depends on:
 *  1. The data-driven computation: max(minSize, value * scaleFactor)
 *  2. CSS constraints from the .node class (min-width / min-height)
 *  3. The sizing CSS class applied (dataDrivenWidth / dataDrivenHeight)
 *
 * When data-driven sizing is active, the dataDrivenWidth / dataDrivenHeight
 * classes must override the base .node minimums so the computed size is the
 * actual rendered size.
 */

import type { DataDrivenSizingConfig } from '@/stores/slices/uiSlice';

/**
 * CSS-imposed minimum dimensions from the .node base class.
 * These constants MUST stay in sync with TaskNode.module.css.
 */
export const NODE_CSS_MIN_WIDTH = 200;
export const NODE_CSS_MIN_HEIGHT = 100;

/**
 * Compute the data-driven size for a single axis.
 * Returns the intended inline style size in pixels, or undefined if
 * data-driven sizing does not apply to this node.
 */
export function computeDataDrivenSize(
  nodeData: Record<string, unknown>,
  config: DataDrivenSizingConfig,
): number | undefined {
  if (!config.enabled || !config.column) return undefined;

  const rawValue = nodeData[config.column];
  if (typeof rawValue !== 'number' || isNaN(rawValue)) return undefined;

  return Math.max(config.minSize, rawValue * config.scaleFactor);
}

/**
 * Compute the effective rendered dimensions of a node, accounting for
 * the data-driven sizing computation.
 *
 * When data-driven sizing is active, the dataDrivenWidth / dataDrivenHeight
 * CSS classes override the base .node min-width / min-height to 0, so the
 * computed size IS the rendered size (no CSS clamping).
 *
 * When data-driven sizing is inactive, the node renders at the CSS base
 * minimum dimensions (content may make it larger, but this gives the floor).
 */
export function computeEffectiveNodeDimensions(
  nodeData: Record<string, unknown>,
  config: { dataDrivenSizing: DataDrivenSizingConfig },
): { width: number; height: number } {
  let width = NODE_CSS_MIN_WIDTH;
  let height = NODE_CSS_MIN_HEIGHT;

  const computedSize = computeDataDrivenSize(nodeData, config.dataDrivenSizing);

  if (computedSize !== undefined) {
    if (config.dataDrivenSizing.axis === 'width') {
      width = computedSize;
    } else {
      height = computedSize;
    }
  }

  return { width, height };
}
