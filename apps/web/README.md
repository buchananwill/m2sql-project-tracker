# m2sql Web UI

Interactive web dashboard for visualizing and syncing Mermaid diagrams with Supabase.

## Features

- 📁 **File Upload** - Import .mmd Mermaid files
- ✏️ **Live Editor** - Edit Mermaid diagrams with real-time parsing
- 📊 **Visual Diagram** - Interactive ReactFlow graph with auto-layout
- ☁️ **Supabase Sync** - Push/pull data to/from Supabase
- ⚠️ **Validation** - Real-time parse error detection

## Quick Start

### 1. Install Dependencies

```bash
cd apps/web
pnpm install
```

### 2. Configure Supabase

#### A. Create `.env.local`

Copy the example file and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### B. Set Up Supabase Functions

**This is required for push/pull to work!**

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Copy the contents of `supabase-setup.sql`
4. Paste and click **Run**

This creates 6 helper functions that the app needs:
- `table_exists()` - Check if tables exist
- `exec_sql()` - Execute SQL for table creation
- `get_table_names()` - List all tables
- `get_columns()` - Get table columns
- `get_primary_keys()` - Get primary keys
- `get_foreign_keys()` - Get foreign keys

### 3. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
pnpm build
pnpm start
```

## Usage

### Import a Mermaid File

1. Click **"Import Mermaid File"**
2. Select a `.mmd` file (e.g., `public/examples/sample.mmd`)
3. The diagram will render automatically

### Edit Mermaid Text

1. Type or paste Mermaid text in the editor
2. Parsing happens automatically (debounced 500ms)
3. Errors are displayed below the editor

### Push to Supabase

1. Load a valid Mermaid file
2. Click **"Push to Supabase"**
3. Tables will be created/updated in your Supabase database

### Pull from Supabase

1. Click **"Pull from Supabase"**
2. Data will be fetched and displayed as a diagram
3. You can then export or edit the Mermaid text

## Architecture

### Tech Stack

- **Next.js 15** (App Router)
- **Mantine UI v7** (components)
- **ReactFlow** (graph visualization)
- **Dagre** (auto-layout algorithm)
- **TypeScript** (full type safety)

### Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout with Mantine
│   ├── page.tsx                # Main UI
│   └── api/supabase/
│       ├── push/route.ts       # API: Push to Supabase
│       └── pull/route.ts       # API: Pull from Supabase
├── components/
│   ├── FileUpload.tsx          # File picker
│   ├── MermaidEditor.tsx       # Code editor
│   ├── ValidationDisplay.tsx   # Error display
│   ├── SyncControls.tsx        # Push/pull buttons
│   └── DiagramRenderer.tsx     # ReactFlow graph
├── lib/
│   ├── reactflow-transform.ts  # Database → Graph transform
│   ├── supabase-client.ts      # Supabase setup
│   └── theme.ts                # Mantine theme
├── public/examples/
│   └── sample.mmd              # Example file
├── supabase-setup.sql          # Required Supabase functions
└── .env.local                  # Environment variables
```

## Troubleshooting

### "Failed to read metadata" Error

**Problem:** Supabase functions are not set up.

**Solution:** Run the `supabase-setup.sql` script in your Supabase SQL Editor.

### Hydration Warnings

**Problem:** Mismatch between server and client rendering.

**Solution:** Already fixed with `suppressHydrationWarning` on `<html>` tag.

### Editor Not Updating

**Problem:** Textarea value seems stuck.

**Solution:** Already fixed with proper controlled input pattern using local state + debouncing.

### Build Errors on Windows

**Problem:** Symlink errors with standalone mode.

**Solution:** Already fixed by removing `output: 'standalone'` from next.config.js.

## API Routes

### POST `/api/supabase/push`

Push a Database model to Supabase.

**Request:**
```json
{
  "database": { /* Database object */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully pushed to Supabase",
  "result": { /* ... */ }
}
```

### POST `/api/supabase/pull`

Pull data from Supabase.

**Request:**
```json
{
  "databaseName": "My Database"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully pulled from Supabase",
  "database": { /* Database object */ }
}
```

## Development

### Adding New Features

1. **New Component** - Add to `components/`
2. **New API Route** - Add to `app/api/`
3. **New Utility** - Add to `lib/`

### Updating Theme

Edit `lib/theme.ts` to customize colors, fonts, and component defaults.

### Debugging

Enable verbose logging in API routes:

```typescript
const result = await pushToSupabase(database, supabase, {
  verbose: true, // Enable logging
});
```

## License

Part of the m2sql monorepo.
