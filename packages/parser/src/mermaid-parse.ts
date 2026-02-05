/**
 * Main Mermaid classDiagram parser.
 * Orchestrates all parsing phases to produce a semantic model.
 */

import { createSlugger, generateAnchor } from './slugify.js';
import { extractFrontmatter } from './mermaid-frontmatter.js';
import { parseHeader } from './mermaid-header.js';
import { parseClassDiagramBody } from './mermaid-body.js';
import { resolveArrowsToRelationships } from './mermaid-arrows.js';
import type {
  ParseResult,
  Database,
  Table,
  Row,
  Relationships,
} from '@m2sql/model';

/**
 * Parse a Mermaid classDiagram file into a semantic model.
 */
export function parseMermaid(content: string): ParseResult {
  const warnings: ParseResult['warnings'] = [];
  const errors: ParseResult['errors'] = [];

  // Phase 1: Extract frontmatter
  const { frontmatter, remainingContent } = extractFrontmatter(content);
  const databaseName = typeof frontmatter.title === 'string' ? frontmatter.title : 'Untitled Database';

  // Phase 2: Parse SQL header
  const { schemas, rawSql, arrowMappings } = parseHeader(content);

  // Phase 3: Parse classDiagram body
  const { namespaces, arrows, triviallyEmptyNamespaces, invalidClasses } = parseClassDiagramBody(remainingContent);

  // Report invalid classes as warnings
  for (const invalid of invalidClasses) {
    warnings.push({
      message: `Class ${invalid.anchor} in namespace ${invalid.namespace}: ${invalid.reason}`,
    });
  }

  // Phase 4: Build anchor-to-table map
  const anchorToTable = new Map<string, string>();
  for (const [tableName, classes] of namespaces) {
    for (const cls of classes) {
      anchorToTable.set(cls.anchor, tableName);
    }
  }

  // Phase 5: Parse arrows and resolve relationships
  const { relationships: resolvedRelationships, errors: arrowErrors } = resolveArrowsToRelationships(
    arrows,
    arrowMappings,
    anchorToTable,
    schemas
  );

  // Add arrow errors to main errors list
  errors.push(...arrowErrors.map(msg => ({ message: msg })));

  // Phase 6: Construct Database/Table/Row model
  const tables: Table[] = [];
  const slugger = createSlugger();

  // Process all namespaces
  for (const [tableName, classes] of namespaces) {
    const schema = schemas.get(tableName);
    const isTriviallyEmpty = triviallyEmptyNamespaces.has(tableName);
    const hasClasses = classes.length > 0;
    const hasInvalidClasses = invalidClasses.some(ic => ic.namespace === tableName);

    // Determine if we should create a table
    if (!schema) {
      if (isTriviallyEmpty) {
        // Trivially empty with no schema - just note it
        warnings.push({
          message: `Namespace '${tableName}' is empty and has no matching schema - discarded`,
        });
      } else {
        // User invested effort but schema is missing - error
        errors.push({
          message: `No schema found for namespace '${tableName}' (has class declarations but missing CREATE TABLE)`,
        });
      }
      continue;
    }

    // Schema exists - create table
    if (isTriviallyEmpty) {
      warnings.push({
        message: `Namespace '${tableName}' is empty - created empty table`,
      });
    } else if (!hasClasses && hasInvalidClasses) {
      warnings.push({
        message: `Namespace '${tableName}' has only invalid classes - created empty table`,
      });
    }

    const rows: Row[] = [];

    for (const cls of classes) {
      // Get relationships for this row
      const rowRelationships: Relationships = {};
      const relEntries = resolvedRelationships.get(cls.anchor) || [];

      // Group by role (junction table name)
      for (const entry of relEntries) {
        const role = entry.role || 'unknown';
        if (!rowRelationships[role]) {
          rowRelationships[role] = [];
        }
        rowRelationships[role]!.push(entry);
      }

      // Create row
      const row: Row = {
        name: cls.name,
        anchor: cls.anchor,
        pk: cls.pk,
        columns: cls.columns,
        relationships: rowRelationships,
      };

      rows.push(row);
    }

    // Create table
    const table: Table = {
      name: tableName,
      schema,
      rawSql: rawSql.get(tableName) || '',
      rows,
    };

    tables.push(table);
  }

  // Phase 7: Create database
  const database: Database = {
    name: databaseName,
    anchor: generateAnchor(slugger, databaseName),
    tables,
  };

  return {
    databases: [database],
    warnings,
    errors,
  };
}
