#!/usr/bin/env node

/**
 * m2sql CLI - Command-line interface for Mermaid to SQL project tracker
 */

import { compile } from './commands/compile.js';
import { validate } from './commands/validate.js';

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

  help                             Show this help message
  version                          Show version number

Examples:
  m2sql compile project.mmd
  m2sql compile project.mmd -o output.db
  m2sql validate project.mmd -v

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
