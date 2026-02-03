# Rules and Templates

## Rules V2
1. **Sections (H1)**: Define major areas. Mark databases with `@database` immediately after H1.
2. **Tables (H2)**: Define tables within a database section.
    - SQL schema in code block at top of H2
    - All H3s under an H2 create rows in that table
3. **Rows (H3)**: Each H3 defines one row.
    - H3 text becomes the `name` column (if it exists)
    - Primary key auto-generated from anchor ID or numerically
4. **Columns (H4)**: `#### Columns` begins column data for the parent H3
    - plain text in yaml style (key: value) for column values
    - Columns not specified use schema defaults
5. **Relationships (H4)**: `#### Relationships` begins junction table entries
    - Self-contained: can be placed anywhere in the document
    - Format: `##### [Table Name]` followed by bullet list
    - Use markdown links to reference other rows
    - Short forms available for common relationships: `part_of`, `depends_on`, `produces`, `consumes`

Recap:
1. H1 → Database name
2. H2 → table name
3. H3 → row
4. H4 → column or relationship row

# Piste Perfect Project Tracker @database {#pp-tracker-1}

## Task

```SQL
create table task
(
    task_id INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    estimate_hours REAL DEFAULT 0.0 NOT NULL,
    notes TEXT DEFAULT '' NOT NULL,
    created_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    updated_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    is_done INTEGER DEFAULT 0 NOT NULL,
    task_type TEXT,
    task_priority INTEGER DEFAULT 0 NOT NULL
);
```

## Deliverable

```SQL
CREATE TABLE deliverable (
    deliverable_id INTEGER PRIMARY KEY,
    deliverable_type_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned',
    owner TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    created_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY(deliverable_type_id) REFERENCES deliverable_type(deliverable_type_id)
);
```

## Deliverable Type

```SQL
CREATE TABLE deliverable_type (
    deliverable_type_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'concrete',
    category TEXT NOT NULL DEFAULT '',
    default_extension TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
);
```

## Task Deliverable

```SQL
CREATE TABLE task_deliverable (
    task_id INTEGER NOT NULL,
    deliverable_id INTEGER NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'produces',
    notes TEXT NOT NULL DEFAULT '',
    created_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (task_id, deliverable_id, relationship),
    FOREIGN KEY(task_id) REFERENCES task(task_id) ON DELETE CASCADE,
    FOREIGN KEY(deliverable_id) REFERENCES deliverable(deliverable_id) ON DELETE CASCADE
);
```

## Task Depends On

```SQL
CREATE TABLE task_depends_on
(
    task_id INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, depends_on_task_id),
    FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES task(task_id) ON DELETE CASCADE,
    CHECK (task_id <> depends_on_task_id)
);
```

## Task Part Of

```SQL
CREATE TABLE task_part_of
(
    child_task_id INTEGER NOT NULL,
    parent_task_id INTEGER NOT NULL,
    PRIMARY KEY (child_task_id, parent_task_id),
    FOREIGN KEY (child_task_id) REFERENCES task(task_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES task(task_id) ON DELETE CASCADE,
    CHECK (child_task_id <> parent_task_id)
);
```

## Tasks For Early Access Release

### Early Access Release

#### Columns

    estimate_hours: 2000
    notes: "Full Early Access Release milestone"
    task_type: milestone

### Complete EAR Core Gameplay Loop

#### Columns

    estimate_hours: 500
    notes: "Will encompass design/planning work, as well as code implementation"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Implement Ski Physics System

#### Columns

    estimate_hours: 120
    notes: "Core skiing mechanics including turning, speed control, and terrain interaction"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Complete EAR Core Gameplay Loop](#complete-ear-core-gameplay-loop)

### Design Ski Control Scheme

#### Columns

    estimate_hours: 16
    notes: "Define input mapping and control feel for skiing"
    task_type: design

#### Relationships

##### Part Of
- parent: [Implement Ski Physics System](#implement-ski-physics-system)

### Code Ski Movement Component

#### Columns

    estimate_hours: 40
    notes: "Implement core skiing physics calculations"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Implement Ski Physics System](#implement-ski-physics-system)

##### Depends On
- [Design Ski Control Scheme](#design-ski-control-scheme)

### Implement Edge Control System

#### Columns

    estimate_hours: 32
    notes: "Carving, skidding, and edge transitions"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Implement Ski Physics System](#implement-ski-physics-system)

##### Depends On
- [Code Ski Movement Component](#code-ski-movement-component)

### Tune Ski Physics Parameters

#### Columns

    estimate_hours: 32
    notes: "Playtest and adjust for feel"
    task_type: tuning

#### Relationships

##### Part Of
- parent: [Implement Ski Physics System](#implement-ski-physics-system)

##### Depends On
- [Implement Edge Control System](#implement-edge-control-system)

### Build First Playable Slope

#### Columns

    estimate_hours: 80
    notes: "Create initial terrain for testing gameplay loop"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Complete EAR Core Gameplay Loop](#complete-ear-core-gameplay-loop)

### Design Starter Slope Layout

#### Columns

    estimate_hours: 12
    notes: "Plan terrain features, difficulty curve, and flow"
    task_type: design

#### Relationships

##### Part Of
- parent: [Build First Playable Slope](#build-first-playable-slope)

### Create Terrain Mesh

#### Columns

    estimate_hours: 24
    notes: "Model the slope geometry"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build First Playable Slope](#build-first-playable-slope)

##### Depends On
- [Design Starter Slope Layout](#design-starter-slope-layout)

### Implement Snow Surface Materials

#### Columns

    estimate_hours: 20
    notes: "Visual and physical properties of snow"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build First Playable Slope](#build-first-playable-slope)

### Add Slope Boundaries and Safety

#### Columns

    estimate_hours: 24
    notes: "Invisible walls, out-of-bounds handling, respawn points"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build First Playable Slope](#build-first-playable-slope)

##### Depends On
- [Create Terrain Mesh](#create-terrain-mesh)

### Develop Crowd Simulation System

#### Columns

    estimate_hours: 200
    notes: "Leverage existing crowd field system for NPC skiers"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Complete EAR Core Gameplay Loop](#complete-ear-core-gameplay-loop)

### Refactor Crowd Field for Skiing Context

#### Columns

    estimate_hours: 60
    notes: "Adapt existing particle-based crowd solver for slopes"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Develop Crowd Simulation System](#develop-crowd-simulation-system)

### Implement NPC Skier Agents

#### Columns

    estimate_hours: 50
    notes: "Create skier entities that use crowd field for pathfinding"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Develop Crowd Simulation System](#develop-crowd-simulation-system)

##### Depends On
- [Refactor Crowd Field for Skiing Context](#refactor-crowd-field-for-skiing-context)

### Add Skier Collision Avoidance

#### Columns

    estimate_hours: 40
    notes: "Prevent NPC-NPC and NPC-player collisions"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Develop Crowd Simulation System](#develop-crowd-simulation-system)

##### Depends On
- [Implement NPC Skier Agents](#implement-npc-skier-agents)

### Optimize Crowd Performance

#### Columns

    estimate_hours: 50
    notes: "Profile and optimize for 100+ concurrent skiers"
    task_type: optimization

#### Relationships

##### Part Of
- parent: [Develop Crowd Simulation System](#develop-crowd-simulation-system)

##### Depends On
- [Add Skier Collision Avoidance](#add-skier-collision-avoidance)

### Create Ski Lift System

#### Columns

    estimate_hours: 100
    notes: "Transport players back to top of slopes"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Complete EAR Core Gameplay Loop](#complete-ear-core-gameplay-loop)

### Design Lift Types and Mechanics

#### Columns

    estimate_hours: 8
    notes: "Chair lift, gondola, T-bar specifications"
    task_type: design

#### Relationships

##### Part Of
- parent: [Create Ski Lift System](#create-ski-lift-system)

### Implement Chair Lift Logic

#### Columns

    estimate_hours: 40
    notes: "Movement system, boarding/disembarking"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Create Ski Lift System](#create-ski-lift-system)

##### Depends On
- [Design Lift Types and Mechanics](#design-lift-types-and-mechanics)

### Create Lift Queue System

#### Columns

    estimate_hours: 32
    notes: "Player and NPC waiting areas, queue management"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Create Ski Lift System](#create-ski-lift-system)

##### Depends On
- [Implement Chair Lift Logic](#implement-chair-lift-logic)

### Add Lift Visual Assets

#### Columns

    estimate_hours: 20
    notes: "Lift towers, chairs, cables"
    task_type: content

#### Relationships

##### Part Of
- parent: [Create Ski Lift System](#create-ski-lift-system)

### Build Core UI System

#### Columns

    estimate_hours: 150
    notes: "Extend existing Slate framework for game needs"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Design UI/UX Flow

#### Columns

    estimate_hours: 16
    notes: "Main menu, HUD, pause menu, settings"
    task_type: design

#### Relationships

##### Part Of
- parent: [Build Core UI System](#build-core-ui-system)

### Implement Main Menu

#### Columns

    estimate_hours: 30
    notes: "Title screen, play button, settings access"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build Core UI System](#build-core-ui-system)

##### Depends On
- [Design UI/UX Flow](#design-ui-ux-flow)

### Create In-Game HUD

#### Columns

    estimate_hours: 40
    notes: "Speed, time, score display using themed components"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build Core UI System](#build-core-ui-system)

##### Depends On
- [Design UI/UX Flow](#design-ui-ux-flow)

### Build Settings Menu

#### Columns

    estimate_hours: 32
    notes: "Graphics, audio, controls configuration"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build Core UI System](#build-core-ui-system)

### Add Modal Dialog System Polish

#### Columns

    estimate_hours: 32
    notes: "Enhance existing modal subsystem for game dialogs"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Build Core UI System](#build-core-ui-system)

### Establish Resort Progression System

#### Columns

    estimate_hours: 120
    notes: "Unlock mechanics and player advancement"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Design Progression Mechanics

#### Columns

    estimate_hours: 16
    notes: "Define unlock tree, currency, and advancement gates"
    task_type: design

#### Relationships

##### Part Of
- parent: [Establish Resort Progression System](#establish-resort-progression-system)

### Implement Unlock System

#### Columns

    estimate_hours: 40
    notes: "Track player progress, unlock slopes and equipment"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Establish Resort Progression System](#establish-resort-progression-system)

##### Depends On
- [Design Progression Mechanics](#design-progression-mechanics)

### Create Challenge System

#### Columns

    estimate_hours: 40
    notes: "Time trials, trick challenges, score targets"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Establish Resort Progression System](#establish-resort-progression-system)

### Build Reward Feedback

#### Columns

    estimate_hours: 24
    notes: "UI notifications, celebrations for unlocks"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Establish Resort Progression System](#establish-resort-progression-system)

##### Depends On
- [Implement Unlock System](#implement-unlock-system)

### Polish and Optimization Pass

#### Columns

    estimate_hours: 200
    notes: "Performance, stability, and feel improvements"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Performance Profiling

#### Columns

    estimate_hours: 40
    notes: "Identify bottlenecks in rendering, physics, AI"
    task_type: optimization

#### Relationships

##### Part Of
- parent: [Polish and Optimization Pass](#polish-and-optimization-pass)

### Optimize Voxel Terrain System

#### Columns

    estimate_hours: 50
    notes: "Improve ResortVoxel module performance"
    task_type: optimization

#### Relationships

##### Part Of
- parent: [Polish and Optimization Pass](#polish-and-optimization-pass)

##### Depends On
- [Performance Profiling](#performance-profiling)

### Add Visual Effects

#### Columns

    estimate_hours: 60
    notes: "Snow spray, dust particles, environmental atmosphere"
    task_type: content

#### Relationships

##### Part Of
- parent: [Polish and Optimization Pass](#polish-and-optimization-pass)

### Audio Implementation

#### Columns

    estimate_hours: 50
    notes: "Skiing sounds, ambient audio, music"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Polish and Optimization Pass](#polish-and-optimization-pass)

### Testing and Bug Fixing

#### Columns

    estimate_hours: 180
    notes: "QA pass, crash fixes, edge case handling"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Establish Test Plan

#### Columns

    estimate_hours: 12
    notes: "Define test cases and acceptance criteria"
    task_type: design

#### Relationships

##### Part Of
- parent: [Testing and Bug Fixing](#testing-and-bug-fixing)

### Execute Playtest Rounds

#### Columns

    estimate_hours: 80
    notes: "Multiple iterations of full gameplay testing"
    task_type: testing

#### Relationships

##### Part Of
- parent: [Testing and Bug Fixing](#testing-and-bug-fixing)

##### Depends On
- [Establish Test Plan](#establish-test-plan)

### Fix Critical Bugs

#### Columns

    estimate_hours: 60
    notes: "Address crashes, gameplay blockers"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Testing and Bug Fixing](#testing-and-bug-fixing)

##### Depends On
- [Execute Playtest Rounds](#execute-playtest-rounds)

### Polish Known Issues

#### Columns

    estimate_hours: 28
    notes: "Minor bugs, visual glitches, UX improvements"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Testing and Bug Fixing](#testing-and-bug-fixing)

### Documentation and Marketing Prep

#### Columns

    estimate_hours: 100
    notes: "Store page, trailer, documentation"
    task_type: structural

#### Relationships

##### Part Of
- parent: [Early Access Release](#early-access-release)

### Write Steam Store Description

#### Columns

    estimate_hours: 8
    notes: "Compelling store page copy"
    task_type: content

#### Relationships

##### Part Of
- parent: [Documentation and Marketing Prep](#documentation-and-marketing-prep)

### Create Gameplay Trailer

#### Columns

    estimate_hours: 40
    notes: "Capture footage, edit, add music"
    task_type: content

#### Relationships

##### Part Of
- parent: [Documentation and Marketing Prep](#documentation-and-marketing-prep)

### Produce Screenshot Assets

#### Columns

    estimate_hours: 12
    notes: "High-quality promotional images"
    task_type: content

#### Relationships

##### Part Of
- parent: [Documentation and Marketing Prep](#documentation-and-marketing-prep)

### Write Player Documentation

#### Columns

    estimate_hours: 20
    notes: "Controls guide, gameplay tips, FAQ"
    task_type: content

#### Relationships

##### Part Of
- parent: [Documentation and Marketing Prep](#documentation-and-marketing-prep)

### Setup Community Infrastructure

#### Columns

    estimate_hours: 20
    notes: "Discord server, feedback channels, bug reporting"
    task_type: implementation

#### Relationships

##### Part Of
- parent: [Documentation and Marketing Prep](#documentation-and-marketing-prep)
