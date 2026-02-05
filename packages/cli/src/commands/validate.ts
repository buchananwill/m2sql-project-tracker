/**
 * Validate command: Check .mmd file syntax without compiling
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMermaid, validateModel } from '@m2sql/parser';

export interface ValidateOptions {
  input: string;
  verbose?: boolean;
}

export function validate(options: ValidateOptions): void {
  const { input, verbose } = options;

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

    let hasErrors = false;

    // Check for parse errors
    if (parseResult.errors.length > 0) {
      hasErrors = true;
      console.error('Parse errors:');
      for (const error of parseResult.errors) {
        console.error(`  ✗ ${error.message}`);
      }
    }

    // Show warnings
    if (parseResult.warnings.length > 0) {
      console.warn('Warnings:');
      for (const warning of parseResult.warnings) {
        console.warn(`  ⚠ ${warning.message}`);
      }
    }

    // Validate model
    if (!hasErrors) {
      const validation = validateModel(parseResult.databases);
      if (!validation.valid) {
        hasErrors = true;
        console.error('Validation errors:');
        for (const error of validation.errors) {
          console.error(`  ✗ [${error.type}] ${error.message}`);
        }
      }
    }

    if (hasErrors) {
      process.exit(1);
    }

    // Success
    const database = parseResult.databases[0];
    if (database) {
      console.log(`✓ Valid: ${database.name}`);
      if (verbose) {
        console.log(`  Tables: ${database.tables.length}`);
        let totalRows = 0;
        for (const table of database.tables) {
          totalRows += table.rows.length;
        }
        console.log(`  Rows: ${totalRows}`);
      }
    } else {
      console.log('✓ Valid syntax (no databases defined)');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}
