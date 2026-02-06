/**
 * YAML frontmatter generation for Mermaid files.
 */

/**
 * Render YAML frontmatter for a database.
 * Format:
 * ---
 * title: Database Name
 * config:
 *     look: handDrawn
 * ---
 */
export function renderFrontmatter(databaseName: string): string {
  return `---
title: ${databaseName}
config:
    look: handDrawn
---`;
}
