#!/usr/bin/env node

/**
 * m2sql CLI - Command-line interface for Mermaid to SQL project tracker
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from './commands/compile.js';
import { validate } from './commands/validate.js';
import { push } from './commands/push.js';
import { pull } from './commands/pull.js';
import { sync } from './commands/sync.js';

// Load environment variables from .env file in project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../../');
config({ path: resolve(projectRoot, '.env') });

const VERSION = '0.1.0';

function showHelp() {
  console.log(`
m2sql - Mermaid to SQL project tracker

Usage:
  m2sql <command> [options]

Commands:
  compile <input.mmd>              Compile Mermaid file to SQLite database
    -o, --output <file>            Output database file (default: <input>.db)
    -v, --verbose                  Show detailed output

  validate <input.mmd>             Validate Mermaid file syntax
    -v, --verbose                  Show detailed output

  push <input.mmd>                 Push Mermaid to Supabase
    --url <supabase-url>           Supabase URL (or SUPABASE_URL env var)
    --key <anon-key>               Supabase anon key (or SUPABASE_KEY env var)
    -v, --verbose                  Show detailed output

  pull                             Pull from Supabase to Mermaid
    -o, --output <file>            Output Mermaid file
    --url <supabase-url>           Supabase URL (or SUPABASE_URL env var)
    --key <anon-key>               Supabase anon key (or SUPABASE_KEY env var)
    --database <name>              Database name (default: "database")
    -v, --verbose                  Show detailed output

  sync <input.db>                  Sync SQLite database to Supabase
    --url <supabase-url>           Supabase URL (or SUPABASE_URL env var)
    --key <anon-key>               Supabase anon key (or SUPABASE_KEY env var)
    -v, --verbose                  Show detailed output

  help                             Show this help message
  version                          Show version number

Examples:
  m2sql compile project.mmd
  m2sql compile project.mmd -o output.db
  m2sql validate project.mmd -v
  m2sql push project.mmd --url <url> --key <key> -v
  m2sql pull -o output.mmd --url <url> --key <key>
  m2sql sync project.db --url <url> --key <key>

Documentation: https://github.com/yourusername/m2sql-project-tracker
`);
}

function showVersion() {
  console.log(`m2sql version ${VERSION}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      showVersion();
      break;

    case 'compile': {
      if (args.length < 2 || !args[1]) {
        console.error('Error: compile command requires an input file');
        console.error('Usage: m2sql compile <input.mmd> [options]');
        process.exit(1);
      }

      const input = args[1] as string;
      let output: string | undefined;
      let verbose = false;

      // Parse options
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-o' || arg === '--output') {
          i++;
          if (i >= args.length) {
            console.error('Error: --output requires a value');
            process.exit(1);
          }
          output = args[i];
        } else if (arg === '-v' || arg === '--verbose') {
          verbose = true;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
      }

      await compile({ input, output, verbose });
      break;
    }

    case 'validate': {
      if (args.length < 2 || !args[1]) {
        console.error('Error: validate command requires an input file');
        console.error('Usage: m2sql validate <input.mmd> [options]');
        process.exit(1);
      }

      const input = args[1] as string;
      let verbose = false;

      // Parse options
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-v' || arg === '--verbose') {
          verbose = true;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
      }

      validate({ input, verbose });
      break;
    }

    case 'push': {
      if (args.length < 2 || !args[1]) {
        console.error('Error: push command requires an input file');
        console.error('Usage: m2sql push <input.mmd> [options]');
        process.exit(1);
      }

      const input = args[1] as string;
      let url: string | undefined;
      let key: string | undefined;
      let verbose = false;

      // Parse options
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--url') {
          i++;
          if (i >= args.length) {
            console.error('Error: --url requires a value');
            process.exit(1);
          }
          url = args[i];
        } else if (arg === '--key') {
          i++;
          if (i >= args.length) {
            console.error('Error: --key requires a value');
            process.exit(1);
          }
          key = args[i];
        } else if (arg === '-v' || arg === '--verbose') {
          verbose = true;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
      }

      await push({ input, url, key, verbose });
      break;
    }

    case 'pull': {
      let output: string | undefined;
      let url: string | undefined;
      let key: string | undefined;
      let database: string | undefined;
      let verbose = false;

      // Parse options
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-o' || arg === '--output') {
          i++;
          if (i >= args.length) {
            console.error('Error: --output requires a value');
            process.exit(1);
          }
          output = args[i];
        } else if (arg === '--url') {
          i++;
          if (i >= args.length) {
            console.error('Error: --url requires a value');
            process.exit(1);
          }
          url = args[i];
        } else if (arg === '--key') {
          i++;
          if (i >= args.length) {
            console.error('Error: --key requires a value');
            process.exit(1);
          }
          key = args[i];
        } else if (arg === '--database') {
          i++;
          if (i >= args.length) {
            console.error('Error: --database requires a value');
            process.exit(1);
          }
          database = args[i];
        } else if (arg === '-v' || arg === '--verbose') {
          verbose = true;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
      }

      if (!output) {
        console.error('Error: pull command requires --output option');
        console.error('Usage: m2sql pull -o <output.mmd> [options]');
        process.exit(1);
      }

      await pull({ output, url, key, database, verbose });
      break;
    }

    case 'sync': {
      if (args.length < 2 || !args[1]) {
        console.error('Error: sync command requires an input file');
        console.error('Usage: m2sql sync <input.db> [options]');
        process.exit(1);
      }

      const input = args[1] as string;
      let url: string | undefined;
      let key: string | undefined;
      let verbose = false;

      // Parse options
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--url') {
          i++;
          if (i >= args.length) {
            console.error('Error: --url requires a value');
            process.exit(1);
          }
          url = args[i];
        } else if (arg === '--key') {
          i++;
          if (i >= args.length) {
            console.error('Error: --key requires a value');
            process.exit(1);
          }
          key = args[i];
        } else if (arg === '-v' || arg === '--verbose') {
          verbose = true;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
      }

      await sync({ input, url, key, verbose });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "m2sql help" for usage information');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
