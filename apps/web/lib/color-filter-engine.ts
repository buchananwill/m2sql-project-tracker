/**
 * Color filter evaluation engine
 *
 * Evaluates color filters against node data to determine styling.
 * Supports text matching, numeric gradients, and numeric bands.
 */

import { interpolate, formatHex } from 'culori';
import type { ColorFilter, NumericGradientRule, NumericBandsRule } from './types/color-filters';

/** Cached interpolator closure: maps a raw numeric value to a hex color */
type PreparedInterpolator = (value: number) => string | null;

/**
 * WeakMap cache for gradient interpolators, keyed on the filter object reference.
 * Since Zustand/immer creates new references on config changes, stale entries
 * are naturally garbage-collected.
 */
const interpolatorCache = new WeakMap<NumericGradientRule, PreparedInterpolator>();

/**
 * Evaluates a list of filters in priority order
 * @param nodeData - The node's data object (columns)
 * @param filters - Array of filters to evaluate (in priority order)
 * @returns Hex color string if a filter matches, null otherwise
 */
export function evaluateFilters(
  nodeData: Record<string, any>,
  filters: ColorFilter[]
): string | null {
  for (const filter of filters) {
    const result = evaluateFilter(nodeData, filter);
    if (result) return result;  // First match wins
  }
  return null;  // No match
}

/**
 * Evaluates a single filter against node data
 * @param nodeData - The node's data object (columns)
 * @param filter - The filter to evaluate
 * @returns Hex color string if filter matches, null otherwise
 */
function evaluateFilter(
  nodeData: Record<string, any>,
  filter: ColorFilter
): string | null {
  switch (filter.type) {
    case 'text_match': {
      // Determine which columns to search
      const cols = filter.allColumns
        ? Object.keys(nodeData)
        : filter.columns;

      for (const col of cols) {
        const value = nodeData[col];
        if (value === undefined || value === null) continue;
        const result = evaluateTextMatch(String(value), filter);
        if (result) return result;
      }
      return null;
    }

    case 'numeric_gradient': {
      const value = nodeData[filter.column];
      if (value === undefined || value === null) return null;
      return interpolateGradient(Number(value), filter);
    }

    case 'numeric_bands': {
      const value = nodeData[filter.column];
      if (value === undefined || value === null) return null;
      return findBand(Number(value), filter);
    }

    default:
      return null;
  }
}

/**
 * Evaluates a text match filter against a string value
 * Supports exact match, contains, and regex patterns
 * @param value - The string value to test
 * @param filter - The text match filter rule
 * @returns Hex color string if match succeeds, null otherwise
 */
function evaluateTextMatch(
  value: string,
  filter: import('./types/color-filters').TextMatchRule
): string | null {
  const ignoreCase = filter.ignoreCase ?? false;

  try {
    switch (filter.matchType) {
      case 'exact': {
        const valueToCompare = ignoreCase ? value.toLowerCase() : value;
        const patternToCompare = ignoreCase ? filter.pattern.toLowerCase() : filter.pattern;
        return valueToCompare === patternToCompare ? filter.color : null;
      }

      case 'contains': {
        const valueToCompare = ignoreCase ? value.toLowerCase() : value;
        const patternToCompare = ignoreCase ? filter.pattern.toLowerCase() : filter.pattern;
        return valueToCompare.includes(patternToCompare) ? filter.color : null;
      }

      case 'regex': {
        const flags = ignoreCase ? 'i' : '';
        const regex = new RegExp(filter.pattern, flags);
        return regex.test(value) ? filter.color : null;
      }

      default:
        return null;
    }
  } catch (error) {
    // Invalid regex or other error - return null
    console.warn('Text match filter error:', error);
    return null;
  }
}

/**
 * Builds a PreparedInterpolator for a gradient rule.
 * Uses culori's oklab color space for perceptually uniform interpolation.
 */
function buildInterpolator(gradient: NumericGradientRule): PreparedInterpolator {
  const sortedStops = [...gradient.stops].sort((a, b) => a.value - b.value);

  if (sortedStops.length === 0) return () => null;

  const minVal = sortedStops[0].value;
  const maxVal = sortedStops[sortedStops.length - 1].value;

  // Build culori color array with explicit positions [color, position] where position is 0..1
  const range = maxVal - minVal;
  const colorPositions = sortedStops.flatMap((stop) => {
    const t = range === 0 ? 0 : (stop.value - minVal) / range;
    return [stop.color, t] as [string, number];
  });

  const interp = interpolate(colorPositions, 'oklab');

  return (value: number) => {
    if (value < minVal || value > maxVal) return null;
    const t = range === 0 ? 0 : (value - minVal) / range;
    return formatHex(interp(t));
  };
}

/**
 * Interpolates color from a gradient based on numeric value.
 * Uses oklab perceptual color space via culori for visually uniform gradients.
 * Interpolators are cached per gradient object reference.
 *
 * @param value - The numeric value to map
 * @param gradient - The gradient rule with stops
 * @returns Hex color string if value is within gradient range, null otherwise
 */
function interpolateGradient(
  value: number,
  gradient: NumericGradientRule
): string | null {
  if (isNaN(value)) return null;

  let interp = interpolatorCache.get(gradient);
  if (!interp) {
    interp = buildInterpolator(gradient);
    interpolatorCache.set(gradient, interp);
  }

  return interp(value);
}

/**
 * Finds the color band that contains the given value
 * @param value - The numeric value to check
 * @param bandsRule - The bands rule with ranges
 * @returns Hex color string if value falls in a band, null otherwise
 */
function findBand(
  value: number,
  bandsRule: NumericBandsRule
): string | null {
  if (isNaN(value)) return null;

  for (const band of bandsRule.bands) {
    if (value >= band.min && value <= band.max) {
      return band.color;
    }
  }

  return null;
}

/**
 * Detects the type of a column based on table schema
 * @param columnType - The SQL type from schema (e.g., "TEXT", "INTEGER", "REAL")
 * @returns 'text' for string types, 'numeric' for number types, 'unknown' otherwise
 */
export function detectColumnType(columnType: string): 'text' | 'numeric' | 'unknown' {
  const normalizedType = columnType.toUpperCase();

  // Numeric types
  if (
    normalizedType.includes('INT') ||
    normalizedType.includes('REAL') ||
    normalizedType.includes('FLOAT') ||
    normalizedType.includes('DOUBLE') ||
    normalizedType.includes('NUMERIC') ||
    normalizedType.includes('DECIMAL')
  ) {
    return 'numeric';
  }

  // Text types
  if (
    normalizedType.includes('TEXT') ||
    normalizedType.includes('CHAR') ||
    normalizedType.includes('VARCHAR') ||
    normalizedType.includes('STRING')
  ) {
    return 'text';
  }

  return 'unknown';
}
