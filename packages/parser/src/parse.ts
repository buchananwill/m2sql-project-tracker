/**
 * Main markdown parser.
 * Transforms markdown into the semantic model.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Heading, Code, Paragraph, Text, Link, List, ListItem } from 'mdast';
import type {
  Database,
  Table,
  Row,
  ColumnValues,
  Relationships,
  RelationshipEntry,
  ParseResult,
  ParseWarning,
  ParseError,
} from '@m2sql/model';
import { parseCreateTable } from '@m2sql/model';
import { createSlugger, generateAnchor } from './slugify.js';
import { parseHeading } from './heading.js';

/** Get plain text content from an mdast node, recursing into inline formatting */
function getTextContent(node: { children: unknown[] }): string {
  let text = '';
  for (const child of node.children) {
    const c = child as { type: string; value?: string; children?: unknown[] };
    if (c.type === 'text') {
      text += c.value ?? '';
    } else if (c.type === 'inlineCode') {
      text += '`' + (c.value ?? '') + '`';
    } else if (c.children) {
      // Recurse into strong, emphasis, link, and other container nodes
      text += getTextContent(c as { children: unknown[] });
    }
  }
  return text;
}

/** Extract link info from a paragraph or list item */
function extractLink(node: Paragraph | ListItem): { text: string; anchor: string } | null {
  for (const child of node.children) {
    if (child.type === 'link') {
      const link = child as Link;
      const url = link.url;
      if (url.startsWith('#')) {
        const anchor = url.slice(1);
        const text = getTextContent(link as unknown as Paragraph);
        return { text, anchor };
      }
    } else if (child.type === 'paragraph') {
      const result = extractLink(child as Paragraph);
      if (result) return result;
    }
  }
  return null;
}

/** Parse YAML-style column values from text */
function parseColumnValues(text: string): ColumnValues {
  const values: ColumnValues = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match key: value (with optional quotes)
    const match = trimmed.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, rawValue] = match;
      if (!key) continue;

      let value: string | number | null = rawValue?.trim() ?? '';

      // Handle quoted strings
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      } else {
        // Try to parse as number
        const num = Number(value);
        if (!isNaN(num) && value !== '') {
          value = num;
        }
      }

      values[key] = value;
    }
  }

  return values;
}

/** State during parsing */
interface ParserState {
  currentDatabase: Database | null;
  currentTable: Table | null;
  currentRow: Row | null;
  currentH4Type: 'columns' | 'relationships' | null;
  currentRelationshipType: string | null;
}

/**
 * Parse a markdown string into the semantic model.
 */
export function parseMarkdown(markdown: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const databases: Database[] = [];

  const slugger = createSlugger();

  // Parse markdown to AST
  const processor = unified().use(remarkParse);
  const tree = processor.parse(markdown) as Root;

  const state: ParserState = {
    currentDatabase: null,
    currentTable: null,
    currentRow: null,
    currentH4Type: null,
    currentRelationshipType: null,
  };

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]!;

    // Handle H1 - database if tagged with @database
    if (node.type === 'heading' && node.depth === 1) {
      const text = getTextContent(node as Heading);
      const parsed = parseHeading(text);

      if (parsed.tags.includes('database')) {
        const anchor = generateAnchor(slugger, parsed.name, parsed.explicitAnchor);
        state.currentDatabase = {
          name: parsed.name,
          anchor,
          tables: [],
        };
        databases.push(state.currentDatabase);
        state.currentTable = null;
        state.currentRow = null;
      }
      continue;
    }

    // Only process further if we're inside a database
    if (!state.currentDatabase) continue;

    // Handle H2 - table definition
    if (node.type === 'heading' && node.depth === 2) {
      const text = getTextContent(node);

      state.currentTable = {
        name: text.trim(),
        schema: { name: '', columns: [], primaryKey: [], uniqueConstraints: [], checkConstraints: [] },
        rawSql: '',
        rows: [],
      };
      state.currentDatabase.tables.push(state.currentTable);
      state.currentRow = null;
      state.currentH4Type = null;
      continue;
    }

    // Handle code block (SQL schema) after H2
    if (node.type === 'code' && state.currentTable && !state.currentRow) {
      const code = node as Code;
      if (code.lang?.toLowerCase() === 'sql') {
        state.currentTable.rawSql = code.value;
        try {
          state.currentTable.schema = parseCreateTable(code.value);
        } catch (e) {
          errors.push({
            message: `Failed to parse SQL schema for table ${state.currentTable.name}: ${e}`,
            line: node.position?.start?.line,
          });
        }
      }
      continue;
    }

    // Handle H3 - row definition
    if (node.type === 'heading' && node.depth === 3) {
      if (!state.currentTable) {
        warnings.push({
          message: `Row heading found outside of table: ${getTextContent(node)}`,
          line: node.position?.start?.line,
        });
        continue;
      }

      const text = getTextContent(node);
      const parsed = parseHeading(text);
      const anchor = generateAnchor(slugger, parsed.name, parsed.explicitAnchor);

      state.currentRow = {
        name: parsed.name,
        anchor,
        pk: parsed.pk,
        columns: {},
        relationships: {},
        sourcePosition: node.position?.start ? {
          line: node.position.start.line,
          column: node.position.start.column,
        } : undefined,
      };
      state.currentTable.rows.push(state.currentRow);
      state.currentH4Type = null;
      state.currentRelationshipType = null;
      continue;
    }

    // Handle H4 - Columns or Relationships section
    if (node.type === 'heading' && node.depth === 4) {
      const text = getTextContent(node).trim().toLowerCase();

      if (text === 'columns') {
        state.currentH4Type = 'columns';
        state.currentRelationshipType = null;
      } else if (text === 'relationships') {
        state.currentH4Type = 'relationships';
        state.currentRelationshipType = null;
      } else {
        state.currentH4Type = null;
      }
      continue;
    }

    // Handle H5 - relationship type (under Relationships)
    if (node.type === 'heading' && node.depth === 5) {
      if (state.currentH4Type === 'relationships' && state.currentRow) {
        state.currentRelationshipType = getTextContent(node).trim();
        if (!state.currentRow.relationships[state.currentRelationshipType]) {
          state.currentRow.relationships[state.currentRelationshipType] = [];
        }
      }
      continue;
    }

    // Handle code block for column values
    if (node.type === 'code' && state.currentH4Type === 'columns' && state.currentRow) {
      const values = parseColumnValues((node as Code).value);
      Object.assign(state.currentRow.columns, values);
      continue;
    }

    // Handle indented text for column values (non-code-block)
    if (node.type === 'paragraph' && state.currentH4Type === 'columns' && state.currentRow) {
      const text = getTextContent(node);
      // Check if it looks like YAML-style key: value
      if (text.includes(':')) {
        const values = parseColumnValues(text);
        Object.assign(state.currentRow.columns, values);
      }
      continue;
    }

    // Handle list for relationships
    if (node.type === 'list' && state.currentH4Type === 'relationships' && state.currentRow && state.currentRelationshipType) {
      const list = node as List;
      const entries: RelationshipEntry[] = state.currentRow.relationships[state.currentRelationshipType] ?? [];

      for (const item of list.children) {
        if (item.type !== 'listItem') continue;

        // Get the text content to find role (e.g., "parent:")
        const itemText = getTextContent(item);
        let role: string | undefined;

        // Check for role prefix like "parent: [Link]"
        const roleMatch = itemText.match(/^(\w+):\s*/);
        if (roleMatch) {
          role = roleMatch[1];
        }

        // Extract the link
        const linkInfo = extractLink(item);
        if (linkInfo) {
          entries.push({
            targetAnchor: linkInfo.anchor,
            displayText: linkInfo.text,
            role,
          });
        } else {
          // Maybe just a plain text reference
          const plainText = itemText.replace(/^\w+:\s*/, '').trim();
          if (plainText) {
            // Try to find an anchor-like reference
            const anchorMatch = plainText.match(/\[([^\]]+)]\(#([^)]+)\)/);
            if (anchorMatch) {
              entries.push({
                targetAnchor: anchorMatch[2]!,
                displayText: anchorMatch[1]!,
                role,
              });
            }
          }
        }
      }

      state.currentRow.relationships[state.currentRelationshipType] = entries;

    }
  }

  return { databases, warnings, errors };
}

/**
 * Build an anchor-to-row lookup map for relationship resolution.
 */
export function buildAnchorMap(databases: Database[]): Map<string, { database: Database; table: Table; row: Row }> {
  const map = new Map<string, { database: Database; table: Table; row: Row }>();

  for (const database of databases) {
    for (const table of database.tables) {
      for (const row of table.rows) {
        map.set(row.anchor, { database, table, row });
      }
    }
  }

  return map;
}
