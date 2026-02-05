/**
 * Compile command: Convert .mmd file to SQLite .db file
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { parseMermaid } from '@m2sql/parser';
import { compileToSqlite } from '@m2sql/sqlite';
import { validateModel } from '@m2sql/parser';

export interface CompileOptions {
  input: string;
  output?: string;
  verbose?: boolean;
}

export async function compile(options: CompileOptions): Promise<void> {
  const { input, output, verbose } = options;

  try {
    // Read input file
    const inputPath = resolve(input);
    if (verbose) {
      console.log(`Reading: ${inputPath}`);
    }

    const content = readFileSync(inputPath, 'utf-8');

    // Parse mermaid
    if (verbose) {
      console.log('Parsing mermaid...');
    }

    const parseResult = parseMermaid(content);

    // Check for parse errors
    if (parseResult.errors.length > 0) {
      console.error('Parse errors:');
      for (const error of parseResult.errors) {
        console.error(`  ✗ ${error.message}`);
      }
      process.exit(1);
    }

    // Show warnings
    if (parseResult.warnings.length > 0 && verbose) {
      console.warn('Warnings:');
      for (const warning of parseResult.warnings) {
        console.warn(`  ⚠ ${warning.message}`);
      }
    }

    // Validate model
    const validation = validateModel(parseResult.databases);
    if (!validation.valid) {
      console.error('Validation errors:');
      for (const error of validation.errors) {
        console.error(`  ✗ [${error.type}] ${error.message}`);
      }
      process.exit(1);
    }

    const database = parseResult.databases[0];
    if (!database) {
      console.error('No database found in input file');
      process.exit(1);
    }

    if (verbose) {
      console.log(`Database: ${database.name}`);
      console.log(`Tables: ${database.tables.length}`);
      for (const table of database.tables) {
        const isJunction = table.rows.some(
          r => r.columns['_lhs_anchor'] !== undefined && r.columns['_rhs_anchor'] !== undefined
        );
        const type = isJunction ? 'junction' : 'data';
        console.log(`  - ${table.name} (${type}): ${table.rows.length} rows`);
      }
    }

    // Compile to SQLite
    if (verbose) {
      console.log('\nCompiling to SQLite...');
    }

    const sqliteDb = await compileToSqlite(parseResult.databases);

    // Determine output path
    const outputPath = output || input.replace(/\.mmd$/, '.db');
    const resolvedOutput = resolve(outputPath);

    // Export database to file
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    writeFileSync(resolvedOutput, buffer);

    sqliteDb.close();

    console.log(`✓ Database compiled: ${resolvedOutput}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}
