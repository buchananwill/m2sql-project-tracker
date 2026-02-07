/**
 * Color filter evaluation engine
 *
 * Evaluates color filters against node data to determine styling.
 * Supports text matching, numeric gradients, and numeric bands.
 */

import type { ColorFilter, NumericGradientRule, NumericBandsRule } from './types/color-filters';

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
  const value = nodeData[filter.column];
  if (value === undefined || value === null) return null;

  switch (filter.type) {
    case 'text_match':
      return evaluateTextMatch(String(value), filter);

    case 'numeric_gradient':
      return interpolateGradient(Number(value), filter);

    case 'numeric_bands':
      return findBand(Number(value), filter);

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
 * Interpolates color from a gradient based on numeric value
 * Uses linear interpolation in RGB color space
 * @param value - The numeric value to map
 * @param gradient - The gradient rule with stops
 * @returns Hex color string if value is within gradient range, null otherwise
 */
function interpolateGradient(
  value: number,
  gradient: NumericGradientRule
): string | null {
  if (isNaN(value)) return null;

  // Sort stops by value ascending
  const sortedStops = [...gradient.stops].sort((a, b) => a.value - b.value);

  // Check if value is out of range
  if (sortedStops.length === 0) return null;
  if (value < sortedStops[0].value) return null;
  if (value > sortedStops[sortedStops.length - 1].value) return null;

  // Find exact match
  const exactMatch = sortedStops.find(stop => stop.value === value);
  if (exactMatch) return exactMatch.color;

  // Find two adjacent stops that bracket the value
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const stop1 = sortedStops[i];
    const stop2 = sortedStops[i + 1];

    if (value >= stop1.value && value <= stop2.value) {
      // Calculate interpolation factor
      const t = (value - stop1.value) / (stop2.value - stop1.value);

      // Interpolate color in RGB space
      const rgb1 = hexToRgb(stop1.color);
      const rgb2 = hexToRgb(stop2.color);

      if (!rgb1 || !rgb2) return null;

      const r = Math.round(rgb1.r + t * (rgb2.r - rgb1.r));
      const g = Math.round(rgb1.g + t * (rgb2.g - rgb1.g));
      const b = Math.round(rgb1.b + t * (rgb2.b - rgb1.b));

      return rgbToHex(r, g, b);
    }
  }

  return null;
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
 * Converts hex color string to RGB object
 * @param hex - Hex color string (e.g., "#ff0000" or "ff0000")
 * @returns RGB object or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return null;
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Converts RGB values to hex color string
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string (e.g., "#ff0000")
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
