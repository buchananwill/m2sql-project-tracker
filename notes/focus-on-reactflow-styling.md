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


# Follow Up Comments 1 - As of 8/2/26

- Filters should be able to match multiple fields
  - E.g. filter text, look in multiple columns for that text
  - Gradient: use white-red to draw attention to hours_estimate and some other column with high values
  - Can bridge filtering across multiple tables: different columns with related content can be matched with same filter
- Debounce filter update to prevent blocking UI
- Improve layout of Gradient Stop filter
  - Use grid layout to make stop identities clearer
  - place color value, numerical stop, and delete button in single row, as a sortable container (see below)
  - Put `Value`, `Color`, `Delete` in header row to describe stops underneath 
  - (_deep refactor_) use drag and drop re-ordering to force stops into logical numerical sequence
    - dragging a stop above another sets its value to be the same as the next stop above/below it
      - a stop's numerical point cannot exceed that of the next stop
      - a stop's numerical point cannot be less than the previous stop
      - validate and enforce these rules when editing the stop point's value directly, force update it when dnd sorting 
    - https://docs.dndkit.com/presets/sortable/usesortable - `useSortable` hook in dndkit supports sorting by dnd#
- Global graph renderer config:
  - Add/remove edges from layout algorithm
  - Switch buttons fix node size H/W separately, gives 4 possible states:
    - free (current design - remains default)
    - fix height: nodes will show their first n columns, hide the rest 
    - fix width: column values get truncate + ellipsis if they overflow the width
      - stretch goal: fixed width can map to a numerical property of each node, with a fallback/minimum in case of null/0
    - fix both: combines behaviours of fix height & fix width. Groundwork for _Gantt chart_ view (later project objective)
  - Show/hide properties per table (node) type
- Collapse subtree (hide children in renderer but keep in model)
- **BIG STRETCH GOAL - TOUCHES MULTIPLE OTHER PACKAGES** Perist Reactflow renderer settings to a new metadata table.
  - Filters implicitly must be valid against database schema
  - Pulling from Supabase can also pull filters to restore the users view
  - other configs also persisted
  - Suggested design routes:
    1. Set up fully-featured filter table that natively captures the color-coding filter model
    2. Serialize the filter state to a BLOB and store it with a timestamp. Try to pull filter BLOB by deserializing back to state model, but soft fail if any error. 
  
# Follow Up Comments 2

- Gradient is using poor color-interpolation algorithm. Suggestion: use `culori` to build an `oklab` interpolation space.
- All rendering updates should be async, as well as debounced.
  - Will require callback to push new layout
  - Will require loading overlay for renderer viewport when update is in flight
  - Example improvements:
    - allows edit hysteresis on text filters
    - prevents layout recalculation blocking main thread
