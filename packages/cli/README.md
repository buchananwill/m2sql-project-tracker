# @m2sql/cli

Command-line interface for the m2sql project tracker.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Compile Mermaid to SQLite

Convert a `.mmd` file to a SQLite `.db` file:

```bash
m2sql compile project.mmd
```

Specify output file:

```bash
m2sql compile project.mmd -o output.db
```

Verbose output:

```bash
m2sql compile project.mmd -v
```

### Validate Mermaid Syntax

Check `.mmd` file syntax without compiling:

```bash
m2sql validate project.mmd
```

Verbose output:

```bash
m2sql validate project.mmd -v
```

### Help

Show all commands:

```bash
m2sql help
```

Show version:

```bash
m2sql version
```

## Development

Run in development mode:

```bash
pnpm dev compile examples/project.mmd -v
```

Build for production:

```bash
pnpm build
```

## Commands

| Command | Description |
|---------|-------------|
| `compile <input.mmd>` | Compile Mermaid file to SQLite database |
| `validate <input.mmd>` | Validate Mermaid file syntax |
| `help` | Show help message |
| `version` | Show version number |

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output <file>` | `-o` | Specify output database file (compile only) |
| `--verbose` | `-v` | Show detailed output |

## Examples

```bash
# Compile with verbose output
m2sql compile examples/project-planner.mmd -v

# Validate before compiling
m2sql validate examples/project-planner.mmd

# Compile to specific output
m2sql compile input.mmd -o /path/to/output.db
```
