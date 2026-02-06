# Phase 1B Manual Testing Checklist

## UI/UX Improvements Testing

### ✅ Setup
1. Start dev server: `cd apps/web && pnpm dev`
2. Open http://localhost:3000 in browser
3. Open browser DevTools (F12) to check for errors

### ✅ Sidebar Functionality
- [ ] **Initial state**: Sidebar should be visible/expanded by default
- [ ] **Burger icon**: Click the burger icon (≡) in the header
- [ ] **Sidebar collapses**: Left sidebar should slide out of view
- [ ] **Graph expands**: Right panel (diagram) should expand to fill space
- [ ] **Burger icon toggles**: Click burger icon again
- [ ] **Sidebar expands**: Left sidebar should slide back into view

### ✅ State Persistence
- [ ] **Collapse sidebar**: Click burger to collapse sidebar
- [ ] **Reload page**: Press F5 or Ctrl+R to reload
- [ ] **State preserved**: Sidebar should remain collapsed after reload
- [ ] **Expand sidebar**: Click burger to expand
- [ ] **Reload again**: Press F5 to reload
- [ ] **State preserved**: Sidebar should remain expanded after reload
- [ ] **Check localStorage**: In DevTools > Application > Local Storage, verify `m2sql-ui-storage` key exists

### ✅ Editor Resize
- [ ] **Find resize handle**: Look for resize handle at bottom-right corner of Mermaid Editor box
- [ ] **Drag handle down**: Click and drag to increase editor height
- [ ] **Verify resize works**: Editor should grow taller
- [ ] **Drag handle up**: Drag to decrease editor height
- [ ] **Verify min height**: Editor should not shrink below ~200px
- [ ] **Test max height**: Try dragging very far down, should stop at ~600px

### ✅ Responsive Behavior
- [ ] **Desktop view**: Start with browser at full width (>768px)
- [ ] **Resize to mobile**: Drag browser window narrower (<768px)
- [ ] **Auto-collapse**: Sidebar should automatically collapse on mobile
- [ ] **Overlay mode**: Click burger on mobile - sidebar should overlay content
- [ ] **Close overlay**: Click outside sidebar or burger icon to close
- [ ] **Resize back**: Make browser wide again (>768px)
- [ ] **Desktop mode**: Sidebar behavior should return to side-by-side

### ✅ IO Controls Section
- [ ] **Section title**: Verify "Data Operations" title is visible in sidebar
- [ ] **File upload button**: "Import Mermaid File" button should be present
- [ ] **Divider**: Visual divider between file upload and sync controls
- [ ] **Sync buttons**: "Push to Supabase" and "Pull from Supabase" buttons visible

### ✅ Existing Functionality Preserved

#### File Upload
- [ ] **Click Import button**: Click "Import Mermaid File"
- [ ] **Select file**: Choose a .mmd file (e.g., public/examples/sample.mmd)
- [ ] **File loads**: Filename should appear next to button
- [ ] **Editor updates**: Mermaid text should appear in editor
- [ ] **Parsing works**: Validation errors or success should show
- [ ] **Diagram renders**: Graph should appear in right panel

#### Editor Functionality
- [ ] **Type in editor**: Manually type or paste Mermaid code
- [ ] **Debounce works**: Wait 500ms after typing stops
- [ ] **Auto-parse**: Diagram should update automatically
- [ ] **Live updates**: Changes should reflect in diagram

#### Supabase Sync
- [ ] **Load database**: Ensure valid database is loaded (file or editor)
- [ ] **Push enabled**: "Push to Supabase" button should be enabled
- [ ] **Click Push**: (Only if .env.local configured) Click push button
- [ ] **Loading state**: Button should show loading spinner
- [ ] **Success/Error**: Alert should show result
- [ ] **Click Pull**: Click "Pull from Supabase" button
- [ ] **Data loads**: Database should update from Supabase
- [ ] **Editor clears**: Editor should clear when pulling from Supabase
- [ ] **Badge updates**: Header badge should show "Supabase" source

#### Validation Display
- [ ] **Type invalid syntax**: Enter invalid Mermaid code in editor
- [ ] **Wait for parse**: Wait for debounce (500ms)
- [ ] **Errors show**: Validation errors should appear in alerts
- [ ] **Fix syntax**: Correct the code
- [ ] **Errors clear**: Validation alerts should disappear

#### Database Info Panel
- [ ] **Load database**: Ensure valid database is parsed
- [ ] **Info panel shows**: "Database Info" panel should appear at bottom of sidebar
- [ ] **Name displayed**: Database name should be shown
- [ ] **Tables count**: Number of tables should be shown
- [ ] **Arrow mappings**: Number of arrow mappings should be shown
- [ ] **Badge shown**: Header should show badge (blue for editor, green for Supabase)

#### Diagram Renderer
- [ ] **Full height**: Diagram should take full height of right panel
- [ ] **Nodes visible**: Data table nodes should render
- [ ] **Edges visible**: Junction table edges should render
- [ ] **Layout works**: Dagre auto-layout should organize nodes
- [ ] **Controls work**: Zoom in/out with mouse wheel or buttons
- [ ] **Pan works**: Click and drag to pan around diagram
- [ ] **Minimap works**: Minimap in corner should show overview

### ✅ Visual Quality
- [ ] **No layout shifts**: No unexpected jumps or shifts when toggling sidebar
- [ ] **Smooth transitions**: Sidebar collapse/expand should be smooth
- [ ] **Header aligned**: Header title and badge should be properly aligned
- [ ] **Spacing consistent**: Padding and gaps should look good throughout
- [ ] **No overlaps**: No elements overlapping or clipped
- [ ] **Readable text**: All text should be clearly readable

### ✅ Console Check
- [ ] **No errors**: DevTools console should show no React errors
- [ ] **No warnings**: No unexpected warnings about hooks or rendering
- [ ] **Store logs**: parseAndSetDatabase logs should appear as expected

## Success Criteria Summary

All of the following must be true:
- ✅ Sidebar collapses and expands with burger button
- ✅ Sidebar state persists across page reloads (localStorage)
- ✅ Editor is resizable vertically with visible handle
- ✅ Sidebar auto-collapses on mobile (<768px)
- ✅ IO controls are consolidated in one section
- ✅ All existing features work (upload, parse, sync, diagram)
- ✅ All 28 tests pass (verified ✅)
- ✅ Production build succeeds (verified ✅)
- ✅ No visual regressions or console errors

## Notes
- If Supabase .env.local is not configured, Push/Pull will fail with API errors (expected)
- On mobile, sidebar should overlay the diagram (not push it to the side)
- The resize handle is a native browser feature (small diagonal lines in corner)
