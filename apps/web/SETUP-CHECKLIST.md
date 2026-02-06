# ✅ Supabase Setup Checklist

Follow these steps to get the m2sql Web UI working with Supabase.

## Prerequisites

- [x] Supabase account created
- [x] Supabase project created
- [x] You have your Supabase URL and anon key

## Step-by-Step Setup

### 1. Configure Environment Variables

**Location:** `apps/web/.env.local`

```bash
# Copy example file
cp .env.local.example .env.local

# Edit with your credentials
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find credentials:**
- Go to: Supabase Dashboard → Settings → API
- Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
- Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Run SQL Setup Script

**Location:** `apps/web/supabase-setup.sql`

**Steps:**
1. Open Supabase Dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Copy entire contents of `supabase-setup.sql`
4. Paste into SQL Editor
5. Click **"Run"** button (or press Ctrl/Cmd + Enter)

**Expected output:**
```
Success. No rows returned
```

**What this does:**
- Creates 6 PostgreSQL functions for schema introspection
- Grants execute permissions to `authenticated` and `anon` roles
- Enables the web UI to create/read tables dynamically

### 3. Verify Functions Exist

Run this query in SQL Editor to verify:

```sql
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'table_exists',
  'exec_sql',
  'get_table_names',
  'get_columns',
  'get_primary_keys',
  'get_foreign_keys'
)
ORDER BY p.proname;
```

**Expected output:** 6 rows showing all functions

### 4. Test the Web UI

```bash
# Start dev server
cd apps/web
pnpm dev

# Open browser
http://localhost:3000
```

**Test Push:**
1. Click "Import Mermaid File"
2. Select `public/examples/sample.mmd`
3. Click "Push to Supabase"
4. Check for success message

**Verify in Supabase:**
1. Go to: Database → Tables
2. You should see new tables created (e.g., `task`, `task_part_of`)

**Test Pull:**
1. Click "Pull from Supabase"
2. Diagram should render with data from database

## Troubleshooting

### ❌ Error: "Failed to read metadata: TypeError: fetch failed"

**Cause:** SQL functions not created yet

**Fix:** Run `supabase-setup.sql` in SQL Editor

---

### ❌ Error: "Missing Supabase environment variables"

**Cause:** `.env.local` not configured

**Fix:**
1. Create `.env.local` file
2. Add your Supabase URL and anon key
3. Restart dev server

---

### ❌ Error: "permission denied for function exec_sql"

**Cause:** Permissions not granted

**Fix:** Run the GRANT statements from `supabase-setup.sql`:

```sql
GRANT EXECUTE ON FUNCTION table_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
-- etc...
```

---

### ✅ Everything works!

**Next steps:**
- Try creating your own Mermaid diagrams
- Explore the diagram visualization
- Check out the data in Supabase tables

## Security Notes

⚠️ **The `exec_sql()` function is powerful!**

- It can execute arbitrary SQL
- Only use with trusted Mermaid diagrams
- Consider adding validation/sanitization for production
- The function is marked `SECURITY DEFINER` to run with elevated privileges

**For production environments:**
- Restrict `exec_sql()` to specific allowed patterns
- Add input validation
- Consider using Row Level Security (RLS) policies
- Monitor SQL execution logs

## Support

If you encounter issues:
1. Check this checklist again
2. Review `apps/web/README.md`
3. Check browser console for errors
4. Check Supabase logs (Dashboard → Logs)
