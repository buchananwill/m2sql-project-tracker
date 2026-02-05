/**
 * Class attribute parsing for Mermaid classDiagram.
 * Parses key: value pairs from class body content.
 */

import type { ColumnValues } from '@m2sql/model';

/**
 * Parse class attributes from class body content.
 * Handles special keys (name:, id:) and type coercion.
 */
export function parseClassAttributes(body: string): {
  name?: string;
  pk?: number;
  columns: ColumnValues;
} {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let name: string | undefined;
  let pk: number | undefined;
  const columns: ColumnValues = {};

  for (const line of lines) {
    // Match key: value pattern
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, valueStr] = match;
    if (!key || valueStr === undefined) continue;

    const trimmedValue = valueStr.trim();

    // Handle special keys
    if (key === 'name') {
      name = trimmedValue;
      continue;
    }

    if (key === 'id') {
      const num = Number(trimmedValue);
      if (!isNaN(num) && Number.isInteger(num)) {
        pk = num;
      }
      continue;
    }

    // Regular column: coerce type
    const value = coerceValue(trimmedValue);
    columns[key] = value;
  }

  return { name, pk, columns };
}

/**
 * Coerce a string value to the appropriate type.
 * Handles numbers, null, and strings.
 */
function coerceValue(value: string): string | number | null {
  // null
  if (value.toLowerCase() === 'null') {
    return null;
  }

  // Number
  const num = Number(value);
  if (!isNaN(num)) {
    return num;
  }

  // String (remove quotes if present)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
