/**
 * Heading parsing utilities.
 * Parses headings to extract name, PK, explicit anchor, and inline tags.
 *
 * H1 format: # Database Name @database {#explicit-anchor}
 * H3 format: ### Row Name `PK: 42` {#explicit-anchor}
 */

export interface ParsedHeading {
  /** Heading text with tags/PK/anchor removed */
  name: string;
  /** Primary key if present */
  pk?: number;
  /** Explicit anchor if present (without the #) */
  explicitAnchor?: string;
  /** Inline tags like @database */
  tags: string[];
}

/**
 * Parse a heading text to extract name, PK, explicit anchor, and inline tags.
 *
 * Examples:
 * - "Early Access Release" -> { name: "Early Access Release", tags: [] }
 * - "Tracker @database" -> { name: "Tracker", tags: ["database"] }
 * - "Early Access Release `PK: 42` {#ear}" -> { name: "Early Access Release", pk: 42, explicitAnchor: "ear", tags: [] }
 */
export function parseHeading(text: string): ParsedHeading {
  let remaining = text.trim();
  let pk: number | undefined;
  let explicitAnchor: string | undefined;
  const tags: string[] = [];

  // Extract explicit anchor {#anchor-name}
  const anchorMatch = remaining.match(/\s*\{#([^}]+)}\s*$/);
  if (anchorMatch) {
    explicitAnchor = anchorMatch[1];
    remaining = remaining.slice(0, anchorMatch.index).trim();
  }

  // Extract PK `PK: 42`
  const pkMatch = remaining.match(/\s*`PK:\s*(\d+)`\s*$/);
  if (pkMatch) {
    pk = parseInt(pkMatch[1]!, 10);
    remaining = remaining.slice(0, pkMatch.index).trim();
  }

  // Extract inline @tags
  const tagRegex = /\s+@(\w+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(remaining)) !== null) {
    if (tagMatch[1]) {
      tags.push(tagMatch[1]);
    }
  }
  remaining = remaining.replace(tagRegex, '').trim();

  return {
    name: remaining,
    pk,
    explicitAnchor,
    tags,
  };
}

/**
 * Format a heading for output (rendering).
 */
export function formatHeading(name: string, pk?: number, anchor?: string): string {
  let result = name;
  if (pk !== undefined) {
    result += ` \`PK: ${pk}\``;
  }
  if (anchor) {
    result += ` {#${anchor}}`;
  }
  return result;
}
