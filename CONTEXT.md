# react-parent-owner-trees

Live parent-tree and owner-tree diagrams of a running React app, drawn in the
julesblom.com parents/owners notation. One context: the diagram language and
the machinery that produces and renders it.

## Trees and structure

**Parent tree**:
The nesting structure — where each node's output sits in the markup.
_Avoid_: DOM tree, render tree

**Owner tree**:
Who rendered whom — the same nodes re-nested by owner refs, so the direct
owner is the parent. Data flow rather than placement.
_Avoid_: render tree, component tree

**InputNode**:
The tree shape every producer emits and the renderer consumes: nesting is the
parent tree, owner refs are the owner tree. The notation's whole input
contract.
_Avoid_: fiber (that's React's structure, upstream of InputNode)

**Producer**:
Anything that emits InputNode trees. Two exist: the live extraction (fibers,
per commit) and the static walker (elements, no React runtime needed).

**Renderer**:
One diagram instance holding all its interactive state (areas, selection,
folds, collapses, marks). Several on a page never share toggles.

**Row**:
One line of the indented diagram — a node at a depth. The flattened unit
that areas, arcs, and elbows are computed over.

**Elbow**:
The solid link drawing tree structure between a row and its children.

**Owner arc**:
The dashed arc drawn in the parent tree for an owner edge — the relation the
tool exists to show.
_Avoid_: owner line, dependency edge

**Fold**:
Merging a consecutive run of same-named siblings into one representative row
(`×n`). Automatic; the user can unfold.
_Avoid_: collapse

**Collapse**:
User-driven hiding of a node's subtree (`▸ n` badge carries the way back in).
_Avoid_: fold

**Subtree scope**:
Narrowing the whole view to one node's parent subtree — the large-app move:
render the region you're working on, not the app. A view, not an edit:
reapplied over the full tree each commit, dissolving back to the full tree
when the node is gone. Distinct from an Area's scope (what a provider or
boundary governs).
_Avoid_: zoom, drill-down

**Mark**:
One of the stageable glyph families (arcs, ids, state dots, memo, markers,
nudge) a figure can render with or without, so glossary figures introduce
notation in dependency order.

**Selection focus**:
Click-to-focus a node's neighborhood: near tree relatives plus its direct
owner and ownees at full strength, everything else fading in place. Layout
never shifts.
_Avoid_: highlight, spotlight

**Salience**:
How much visual weight a mark claims. Salience must track importance — never
instance count or leaf count; repetition folds instead of shouting.

**Blink**:
The one-shot fading halo on a row that performed work in the commit just
drawn — actual renders, never bailed-out reconciliation visits. Ambient
liveness, pitched for peripheral vision; replays on commits only, never on
interaction re-renders.
_Avoid_: flash, highlight-updates

**Page highlight**:
The selected row's claim made literal: while a row is focused, the DOM
region its output governs is outlined in the running app. Follows the
selection, re-resolves on every commit, never moves the page; rows with
nothing on the page (ghosts, departed, hidden subtrees) honestly outline
nothing.
_Avoid_: inspect, DOM highlight

## Server components

**Ghost row**:
A server component's row: your function ran, but no fiber exists behind it.
Filled circle, italic name, server color.

**Server host row**:
DOM output created during a server render — a real fiber and DOM node whose
element arrived as payload data.

**Server region**:
The translucent tinted rect behind a contiguous run of server rows.

**Boundary entry**:
A client component whose owner is a server component — where props crossed
the network. Marked only by the `'use client'` badge.

**App only**:
Scoping both views to the RSC program the author wrote: server components
plus everything they transitively own. Framework wrapper components drop out.

## Scopes and areas

**Area**:
The tinted rect showing what a clickable row governs. Rows that scope
something are clickable and have areas; rows that don't, aren't.

**Catch region**:
A Suspense or error boundary's area, EXCLUSIVE: its subtree minus nested
same-kind subtrees — exactly the rows for which it is the closest boundary.

**Context area**:
A provider's area — everything that *can* consume — plus the value dot at its
right edge and delivery lines into each row that actually reads the context.

**Delivery line**:
The line from a context's value dot into an actual consumer, ending at the
consumer's name.

**Potential**:
Declared but not mounted: a fallback drawn from its prop while the boundary
shows primary content. Dashed outline; no fiber exists yet.
_Avoid_: hidden, inactive

**Departed**:
Unmounted by a crash — what stood under an error boundary before it caught.
Fibers destroyed, state lost.

**Dormant**:
Alive but not shown: the preserved primary subtree of a suspended boundary,
or a hidden `<Activity>` subtree. Dimmed, state intact.

**Structural row**:
A fiber React persists with no function of yours and no DOM node behind it
(Fragment, StrictMode, Profiler). Square glyph: React's own machinery is a
different species from rendered output.

**Memo disc**:
The filled violet disc a `React.memo` component sits inside — containment,
not adornment; owner arcs end on the disc because props are delivered to the
comparison gate.

**Hooks strip**:
A component's primitive hooks in call order, one small glyph per call,
drawn after the row's text. Subsumes the stacked state dots while on.

## Stability figure

**Snapshot**:
One commit's measured values, drawn as a column.

**Identity thread**:
The horizontal line through snapshots where `Object.is` says a reference
survived.

**Break**:
A value getting a new identity between snapshots (amber flash, amber ×).

**Memory shelf**:
The right-edge compartment showing what the fiber holds *now* — hooks
compartment vs replaced-every-render compartment.

**Durée cube**:
The stacked view: snapshot cards cascading into depth, newest in front, so an
unbroken identity thread reads as a skewer through the stack.
