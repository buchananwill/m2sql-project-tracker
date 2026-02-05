/**
 * YAML frontmatter parsing for Mermaid files.
 * Extracts and parses YAML frontmatter between --- delimiters.
 */

import { parse as parseYaml } from 'yaml';

export interface Frontmatter {
  title?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Extract YAML frontmatter from document content.
 * Returns the frontmatter object and the remaining content.
 */
export function extractFrontmatter(content: string): {
  frontmatter: Frontmatter;
  remainingContent: string;
} {
  const lines = content.split('\n');

  // Look for frontmatter after the SQL header comments
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (line === '---') {
      if (startIdx === -1) {
        startIdx = i;
      } else {
        endIdx = i;
        break;
      }
    }
  }

  // No frontmatter found
  if (startIdx === -1 || endIdx === -1) {
    return {
      frontmatter: {},
      remainingContent: content,
    };
  }

  // Extract YAML content
  const yamlContent = lines.slice(startIdx + 1, endIdx).join('\n');

  // Parse YAML
  let frontmatter: Frontmatter = {};
  try {
    const parsed = parseYaml(yamlContent);
    if (parsed && typeof parsed === 'object') {
      frontmatter = parsed as Frontmatter;
    }
  } catch (error) {
    // Invalid YAML, return empty frontmatter
    console.warn('Failed to parse YAML frontmatter:', error);
  }

  // Remaining content is everything after the closing ---
  const remainingContent = lines.slice(endIdx + 1).join('\n');

  return {
    frontmatter,
    remainingContent,
  };
}
