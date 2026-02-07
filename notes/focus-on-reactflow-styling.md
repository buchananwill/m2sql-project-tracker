# React Flow Styling

## Preamble

The project tracker now has a working IO for text edit, file upload, and Supabase syncing. Although there a lots of good
ideas to improve this, the core value provided by the web UI is visualizing the current state of the database. This will
thus be the focus of the next development sprint.

## Problems To Fix

1. Viewport seems to be partly hidden by header panel - possible arising from the AppShell Mantine component?

## Features to add

1. Colour code nodes according to done status.
2. Configurable spacing between nodes: reduce/increase; interplays with fixing dimensions (see below).
3. Show more details of the task row data.
   1. Menu to filter which details are visible in main view
   2. Click interaction to get popover/modal for full details of node
4. Option to render nodes as fixed height/width/both, truncating with ellipsis any text that doesn't fit.
   1. Fixed Height: will combine well with a Gantt-style view
   2. Fixed width: keeps overall width of graph under control for easier overview.
   3. Fixed both: provides "compact" version of graph for best overview.
5. Nodes are currently the stock Reactflow look-and-feel - it would be good to stamp a more "branded" style on them. 


# Follow Up Comments

- Filters should be able to match multiple fields
- Debounce filter update to prevent blocking UI
- Show/hide properties per table (node) type
- Collapse subtree (hide children in renderer but keep in model)
- Add/remove edges from layout algorithm
- Still not about to fix node size and truncate text
- **BIG STRETCH GOAL** Perist filter set to a new metadata table.
  - Filters implicitly must be valid against database schema
  - Pulling from Supabase can also pull filters to restore the users view