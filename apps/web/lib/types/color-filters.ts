/**
 * Color coding filter system types
 *
 * Supports three types of filters:
 * 1. Text Match - Exact string matching for categorical data
 * 2. Numeric Gradient - Interpolated color gradient for continuous numeric data
 * 3. Numeric Bands - Discrete integer ranges for ranked/categorized numbers
 */

/**
 * Text match filter - exact string matching
 * Example: status="done" → green
 */
export type TextMatchRule = {
  type: 'text_match';
  column: string;
  matches: string;      // Exact text to match
  color: string;        // Hex color (e.g., "#90ee90")
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
