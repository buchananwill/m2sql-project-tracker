/**
 * @m2sql/sqlite - SQLite compilation and extraction
 */

export { compileToSqlite, exportDatabase } from './compile.js';
export { extractFromDb, extractFromSqlite } from './extract.js';
export {
  createMetadataTable,
  insertArrowMapping,
  readArrowMappings,
  type ArrowMappingMetadata,
} from './metadata.js';
