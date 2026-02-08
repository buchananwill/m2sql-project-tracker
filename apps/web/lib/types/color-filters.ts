/**
 * Color coding filter system types
 *
 * Supports three types of filters:
 * 1. Text Match - Exact string matching for categorical data
 * 2. Numeric Gradient - Interpolated color gradient for continuous numeric data
 * 3. Numeric Bands - Discrete integer ranges for ranked/categorized numbers
 */

/**
 * Text match filter - flexible string matching
 * Supports exact match, contains, and regex.
 * Can target multiple columns; matches if any column matches.
 */
export type TextMatchRule = {
  type: 'text_match';
  columns: string[];       // Columns to search (ignored when allColumns is true)
  allColumns?: boolean;    // When true, search every column on the node
  matchType: 'exact' | 'contains' | 'regex';  // Match type
  pattern: string;         // Text or regex pattern to match
  ignoreCase?: boolean;    // Ignore case (default: false)
  color: string;           // Hex color (e.g., "#90ee90")
};

/**
 * Numeric gradient filter - interpolated color gradient
 * Example: hours: 0→white, 50→yellow, 100→red
 */
export type NumericGradientRule = {
  type: 'numeric_gradient';
  column: string;
  stops: Array<{ value: number; color: string }>;
};

/**
 * Numeric bands filter - discrete integer ranges
 * Example: priority: 1→red, 2→orange, 3→yellow, 4→green
 */
export type NumericBandsRule = {
  type: 'numeric_bands';
  column: string;
  bands: Array<{ min: number; max: number; color: string }>;
};

/**
 * Union type for all filter types
 */
export type ColorFilter = TextMatchRule | NumericGradientRule | NumericBandsRule;

/**
 * Filter configuration for a node element (background, border, or text)
 * Filters are evaluated in priority order (array index)
 * First matching filter wins
 */
export type ElementFilters = {
  element: 'background' | 'border' | 'text';
  filters: ColorFilter[];  // Priority order - first match wins
};

/**
 * Complete color coding configuration
 * Each element type has its own filter list
 */
export type ColorCodingConfig = {
  background: ColorFilter[];
  border: ColorFilter[];
  text: ColorFilter[];
};
