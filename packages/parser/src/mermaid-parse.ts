/**
 * Main Mermaid classDiagram parser.
 * Orchestrates all parsing phases to produce a semantic model.
 */

import { createSlugger, generateAnchor } from './slugify.js';
import { extractFrontmatter } from './mermaid-frontmatter.js';
import { parseHeader } from './mermaid-header.js';
import { parseClassDiagramBody } from './mermaid-body.js';
import { resolveArrowsToJunctionRows } from './mermaid-arrows.js';
import type {
  ParseResult,
  Database,
  Table,
  Row,
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

  // Phase 5: Parse arrows and create junction table rows
  const { junctionRows, errors: arrowErrors } = resolveArrowsToJunctionRows(
    arrows,
    arrowMappings,
    anchorToTable,
    schemas
  );

  // Add arrow errors to main errors list
  errors.push(...arrowErrors.map(msg => ({ message: msg })));

  // Group junction rows by table
  const junctionRowsByTable = new Map<string, typeof junctionRows>();
  for (const jRow of junctionRows) {
    const existing = junctionRowsByTable.get(jRow.junctionTable) || [];
    existing.push(jRow);
    junctionRowsByTable.set(jRow.junctionTable, existing);
  }

  // Phase 6: Construct Database/Table/Row model
  const tables: Table[] = [];
  const slugger = createSlugger();

  // First, create tables for all schemas (including junction tables)
  for (const [tableName, schema] of schemas) {
    // Check if this table has a namespace
    if (!namespaces.has(tableName)) {
      // No namespace - likely a junction table
      // Create rows from junction row data
      const jRows = junctionRowsByTable.get(tableName) || [];
      const rows: Row[] = [];

      for (const jRow of jRows) {
        // Store anchors directly - compiler will resolve to IDs
        const row: Row = {
          name: `${jRow.lhsAnchor} → ${jRow.rhsAnchor}`,
          anchor: generateAnchor(slugger, `${tableName}_${jRow.lhsAnchor}_${jRow.rhsAnchor}`),
          columns: {
            _lhs_anchor: jRow.lhsAnchor,  // Temp column for LHS anchor
            _rhs_anchor: jRow.rhsAnchor,  // Temp column for RHS anchor
            ...(jRow.label && schema.columns.some(c => c.name === 'label') ? { label: jRow.label } : {}),
          },
          relationships: {},
        };

        rows.push(row);
      }

      const table: Table = {
        name: tableName,
        schema,
        rawSql: rawSql.get(tableName) || '',
        rows,
      };
      tables.push(table);
    }
  }

  // Then, process namespaces with classes (data tables)
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
      // Create row (no nested relationships)
      const row: Row = {
        name: cls.name,
        anchor: cls.anchor,
        pk: cls.pk,
        columns: cls.columns,
        relationships: {}, // Relationships are now separate junction table rows
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

  // Phase 7: Create database with arrow mappings
  const arrowMappingsArray = Array.from(arrowMappings.values()).map(mapping => ({
    junctionTable: mapping.junctionTable,
    leftColumn: mapping.leftColumn,
    arrowToken: mapping.arrowToken,
    rightColumn: mapping.rightColumn,
  }));

  const database: Database = {
    name: databaseName,
    anchor: generateAnchor(slugger, databaseName),
    tables,
    arrowMappings: arrowMappingsArray,
  };

  return {
    databases: [database],
    warnings,
    errors,
  };
}
