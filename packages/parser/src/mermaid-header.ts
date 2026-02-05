/**
 * SQL header parsing for Mermaid files.
 * Extracts CREATE TABLE statements and arrow mappings from %% comments.
 */

import { parseCreateTable } from '@m2sql/model';
import type { TableSchema } from '@m2sql/model';

export interface ArrowMapping {
  /** Left FK column name */
  leftColumn: string;
  /** Arrow token */
  arrowToken: string;
  /** Right FK column name */
  rightColumn: string;
  /** Junction table name */
  junctionTable: string;
}

export interface ParsedHeader {
  /** Parsed table schemas from CREATE TABLE statements */
  schemas: Map<string, TableSchema>;
  /** Raw SQL for each table */
  rawSql: Map<string, string>;
  /** Arrow mappings (arrow_token -> mapping details) */
  arrowMappings: Map<string, ArrowMapping>;
}

/**
 * Parse the SQL header and arrow mappings from %% comment lines.
 * Returns schemas, raw SQL, and arrow mappings.
 */
export function parseHeader(content: string): ParsedHeader {
  const lines = content.split('\n');
  const schemas = new Map<string, TableSchema>();
  const rawSql = new Map<string, string>();
  const arrowMappings = new Map<string, string>();

  let currentSql = '';
  let insideFrontmatter = false;
  let frontmatterCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Track frontmatter boundaries (skip everything between --- delimiters)
    if (trimmed === '---') {
      frontmatterCount++;
      if (frontmatterCount === 1) {
        insideFrontmatter = true;
      } else if (frontmatterCount === 2) {
        insideFrontmatter = false;
      }
      continue;
    }

    // Skip lines inside frontmatter
    if (insideFrontmatter) {
      continue;
    }

    // Check if this is a comment line
    if (trimmed.startsWith('%%')) {
      const content = trimmed.slice(2).trim();

      // Check for arrow mapping: %% left_column arrow_token right_column : junction_table
      const arrowMatch = content.match(/^(\w+)\s+([*.\-<>|]+)\s+(\w+)\s*:\s*(\w+)$/);
      if (arrowMatch) {
        const [, leftColumn, arrowToken, rightColumn, junctionTable] = arrowMatch;
        if (leftColumn && arrowToken && rightColumn && junctionTable) {
          arrowMappings.set(arrowToken, {
            leftColumn,
            arrowToken,
            rightColumn,
            junctionTable,
          });
        }
        continue;
      }

      // Otherwise, accumulate SQL
      if (content) {
        currentSql += content + '\n';
      }

      // If we have a complete CREATE TABLE statement, parse it
      if (content.includes(');')) {
        try {
          const schema = parseCreateTable(currentSql.trim());
          schemas.set(schema.name, schema);
          rawSql.set(schema.name, currentSql.trim());
        } catch (error) {
          console.warn('Failed to parse CREATE TABLE:', error);
        }
        currentSql = '';
      }
    } else if (trimmed.startsWith('classDiagram')) {
      // Reached body, stop parsing header
      break;
    }
  }

  return { schemas, rawSql, arrowMappings };
}
