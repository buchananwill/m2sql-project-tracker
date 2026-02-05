/**
 * Script to compile project-planner.mmd to SQLite database
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMermaid } from './packages/parser/src/mermaid-parse.js';
import { compileToSqlite } from './packages/sqlite/src/compile.js';

async function main() {
  // Read the example mermaid file
  const mermaidPath = join(process.cwd(), 'examples', 'project-planner.mmd');
  const content = readFileSync(mermaidPath, 'utf-8');
  console.log('Reading:', mermaidPath);

  // Parse the mermaid file
  console.log('Parsing mermaid...');
  const parseResult = parseMermaid(content);

  if (parseResult.errors.length > 0) {
    console.error('Parse errors:');
    for (const error of parseResult.errors) {
      console.error(`  - ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Parsed ${parseResult.databases.length} database(s)`);
  const db = parseResult.databases[0];
  if (db) {
    console.log(`  Database: ${db.name}`);
    console.log(`  Tables: ${db.tables.map(t => t.name).join(', ')}`);
    for (const table of db.tables) {
      console.log(`    - ${table.name}: ${table.rows.length} rows`);
    }
  }

  // Compile to SQLite
  console.log('\nCompiling to SQLite...');
  const sqliteDb = await compileToSqlite(parseResult.databases);

  // Export to file
  const outputPath = join(process.cwd(), 'project-planner.db');
  const data = sqliteDb.export();
  const buffer = Buffer.from(data);
  writeFileSync(outputPath, buffer);

  console.log(`\n✓ Database saved to: ${outputPath}`);
  console.log('\nYou can inspect it with:');
  console.log(`  sqlite3 ${outputPath}`);
}

main().catch(console.error);
