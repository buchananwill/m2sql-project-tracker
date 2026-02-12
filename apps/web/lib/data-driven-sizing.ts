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
/**
 * Fixed dimensions from CSS sizing classes.
 * Must stay in sync with TaskNode.module.css .fixedWidth / .fixedHeight.
 */
export const FIXED_WIDTH = 200;
export const FIXED_HEIGHT = 100;

/**
 * Compute the inline style that TaskNode should apply for sizing.
 *
 * Returns undefined when data-driven sizing is inactive.
 * When active, the returned style always contains the data-driven axis.
 * If fixWidth / fixHeight is set on the non-driven axis, that fixed
 * dimension is also included so the inline style overrides the
 * CSS class's `auto` value.
 */
export function computeNodeInlineStyle(
  nodeData: Record<string, unknown>,
  config: {
    dataDrivenSizing: DataDrivenSizingConfig;
    fixWidth: boolean;
    fixHeight: boolean;
  },
): Record<string, string> | undefined {
  const { dataDrivenSizing, fixWidth, fixHeight } = config;
  if (!dataDrivenSizing.enabled || !dataDrivenSizing.column) return undefined;

  const rawValue = nodeData[dataDrivenSizing.column];
  if (typeof rawValue !== 'number' || isNaN(rawValue)) return undefined;

  const computedSize = Math.max(dataDrivenSizing.minSize, rawValue * dataDrivenSizing.scaleFactor);
  const style: Record<string, string> = {
    [dataDrivenSizing.axis]: `${computedSize}px`,
  };

  // When the non-driven axis is fixed, include it in the inline style
  // so it overrides the CSS class's `auto` value.
  if (dataDrivenSizing.axis === 'width' && fixHeight) {
    style.height = `${FIXED_HEIGHT}px`;
  } else if (dataDrivenSizing.axis === 'height' && fixWidth) {
    style.width = `${FIXED_WIDTH}px`;
  }

  return style;
}

export function computeEffectiveNodeDimensions(
  nodeData: Record<string, unknown>,
  config: {
    dataDrivenSizing: DataDrivenSizingConfig;
    fixWidth?: boolean;
    fixHeight?: boolean;
  },
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

/**
 * Enrich ReactFlow nodes with pre-computed data-driven dimensions.
 *
 * This ensures dagre receives correct sizes even when DOM measurement
 * hasn't occurred yet (e.g. first layout, or when a rAF race condition
 * clears the measurement cache).
 *
 * Nodes that don't have a numeric value for the sizing column are left
 * unchanged (dagre will use its default 200×100 fallback).
 */
export function precomputeNodeDimensions<T extends { data: Record<string, unknown>; width?: number | null; height?: number | null }>(
  nodes: T[],
  config: {
    dataDrivenSizing: DataDrivenSizingConfig;
    fixWidth?: boolean;
    fixHeight?: boolean;
  },
): T[] {
  if (!config.dataDrivenSizing.enabled || !config.dataDrivenSizing.column) {
    return nodes;
  }

  return nodes.map(node => {
    const dims = computeEffectiveNodeDimensions(node.data, config);
    return { ...node, width: dims.width, height: dims.height };
  });
}
