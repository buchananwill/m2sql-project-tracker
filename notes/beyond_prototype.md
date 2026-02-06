# Beyond Prototype

The prototyping phase is over, and there is a working pipeline with:

1. Mermaid parsing
2. SQLite compiling
3. Supabase push/pull syncing
4. Web UI with Reactflow graph renderer.

This demonstrates the overall concept effectively, but is short of a truly useful tool yet.

## Ideas for Further Development

1. Consolidate scattered, piecemeal state-tracking across Web UI application into a production-grade state system, e.g.
   Zustand.
2. Update table definitions to add columns from a more detailed table definition than exists in the database.
    1. If the declared table DDL does not match that currently in Supabase, the user should be informed.
    2. Options presented should be:
        1. Strip columns not in database from the in-memory model and upsert.
        2. Add columns not in the database, then upsert from in-memory model.
3. Make the Reactflow an editable renderer
    1. adding/removing connections updates the in-memory model.
    2. Nodes can be added or deleted.
    3. Working design principle at present is "pushes to Supabase are additive, never subtractive".
        1. Default deletion behaviour in the Reactflow viewport should be *only* to remove from the in-memory model
        2. Deleting task-rows from the Supabase persistence is a later feature that will take careful planning.
        3. Implied outcome is that transient nodes/edges will be culled from a push, but deleting already persisted ones
           only cleans up the working space.
    4. Non-protected data (so excluding PK, anchor) for a node/row can be edited and upserted with supabase-push.
4. Basic configurable graph layout in the Reactflow renderer:
   1. +/- spacing between nodes (siblings and generational spacing)
   2. Choose top/left/bottom/right as the root side of the viewport.
5. Advanced graph layout configuration:
   1. Optional size scaling in sibling axis according to any chosen number field (in the example we'd want `estimate_hours`)
   2. Gantt chart layout algorithm:
      1. Serial dependencies create ranking along one axis
      2. Compositional relationships create ranking along the other axis
      3. General principle: for up to two chosen relationships, each is used to rank along a specific axis for "critical path" style layout
