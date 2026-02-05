/**
 * Mermaid classDiagram body parsing.
 * Extracts namespaces (tables), classes (rows), and arrows (relationships).
 */

import { parseClassAttributes } from './mermaid-attributes.js';
import type { ColumnValues } from '@m2sql/model';

export interface ParsedClass {
  /** Class identifier/anchor */
  anchor: string;
  /** Row name from name: attribute (required) */
  name: string;
  /** Primary key from id: attribute (optional) */
  pk?: number;
  /** Column values */
  columns: ColumnValues;
}

export interface ParsedBody {
  /** Namespaces (table_name -> classes) */
  namespaces: Map<string, ParsedClass[]>;
  /** Arrow lines for relationship parsing */
  arrows: string[];
  /** Namespaces that are trivially empty (no class declarations at all) */
  triviallyEmptyNamespaces: Set<string>;
  /** Classes that were declared but invalid (failed validation) */
  invalidClasses: Array<{ namespace: string; anchor: string; reason: string }>;
}

/**
 * Parse the classDiagram body to extract namespaces, classes, and arrows.
 */
export function parseClassDiagramBody(content: string): ParsedBody {
  const namespaces = new Map<string, ParsedClass[]>();
  const arrows: string[] = [];
  const triviallyEmptyNamespaces = new Set<string>();
  const invalidClasses: Array<{ namespace: string; anchor: string; reason: string }> = [];

  // First, find the classDiagram declaration
  const classDiagramMatch = content.match(/classDiagram\s+([\s\S]*)/);
  if (!classDiagramMatch) {
    return { namespaces, arrows, triviallyEmptyNamespaces, invalidClasses };
  }

  const bodyContent = classDiagramMatch[1] ?? '';

  // Extract namespace blocks manually (handling nested braces)
  const namespaceMatches = extractNamespaces(bodyContent);

  for (const { name, content: namespaceContent } of namespaceMatches) {
    const { classes, invalidClasses: nsInvalidClasses, hasClassDeclarations } = parseClassesFromNamespace(namespaceContent);

    // Track invalid classes for this namespace
    for (const invalid of nsInvalidClasses) {
      invalidClasses.push({ namespace: name, ...invalid });
    }

    // Always register the namespace
    namespaces.set(name, classes);

    // Track if namespace is trivially empty (no class declarations at all)
    if (!hasClassDeclarations) {
      triviallyEmptyNamespaces.add(name);
    }
  }

  // Extract arrow lines (outside namespace blocks)
  // Remove namespace blocks first
  let contentWithoutNamespaces = bodyContent;
  for (const { fullMatch } of namespaceMatches) {
    contentWithoutNamespaces = contentWithoutNamespaces.replace(fullMatch, '');
  }

  // Find arrow lines
  const lines = contentWithoutNamespaces.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Match arrow patterns: LHS arrow RHS
    if (trimmed && /\w+\s+[*.\-<>|]+\s+\w+/.test(trimmed)) {
      arrows.push(trimmed);
    }
  }

  return { namespaces, arrows, triviallyEmptyNamespaces, invalidClasses };
}

/**
 * Extract namespace blocks with proper brace matching.
 */
function extractNamespaces(content: string): Array<{
  name: string;
  content: string;
  fullMatch: string;
}> {
  const results: Array<{ name: string; content: string; fullMatch: string }> = [];
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }

    const match = line.match(/^\s*namespace\s+(\w+)\s*\{/);
    if (match) {
      const namespaceName = match[1];
      if (!namespaceName) {
        i++;
        continue;
      }

      // Find matching closing brace
      let depth = 1;
      let j = i + 1;
      const contentLines: string[] = [];

      while (j < lines.length && depth > 0) {
        const currentLine = lines[j] ?? '';

        // Count braces
        for (const char of currentLine) {
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }

        if (depth > 0) {
          contentLines.push(currentLine);
        }

        j++;
      }

      const namespaceContent = contentLines.join('\n');
      const fullMatch = lines.slice(i, j).join('\n');

      results.push({
        name: namespaceName,
        content: namespaceContent,
        fullMatch,
      });

      i = j;
    } else {
      i++;
    }
  }

  return results;
}

/**
 * Parse classes within a namespace block.
 */
function parseClassesFromNamespace(content: string): {
  classes: ParsedClass[];
  invalidClasses: Array<{ anchor: string; reason: string }>;
  hasClassDeclarations: boolean;
} {
  const classes: ParsedClass[] = [];
  const invalidClasses: Array<{ anchor: string; reason: string }> = [];

  // Match class definitions: class ClassName:::style{...}
  const classRegex = /class\s+(\w+)(?::::(\w+))?\s*\{([^}]*)\}/g;
  let classMatch;
  let hasClassDeclarations = false;

  while ((classMatch = classRegex.exec(content)) !== null) {
    hasClassDeclarations = true;
    const [, anchor, , body] = classMatch;
    if (!anchor || !body) continue;

    const { name, pk, columns } = parseClassAttributes(body);

    // name is required
    if (!name) {
      invalidClasses.push({
        anchor,
        reason: "Missing required 'name:' attribute",
      });
      continue;
    }

    classes.push({
      anchor,
      name,
      pk,
      columns,
    });
  }

  return { classes, invalidClasses, hasClassDeclarations };
}
