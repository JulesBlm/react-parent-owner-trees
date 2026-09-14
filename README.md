# react-trees-tool

Prototype: live parent tree and owner tree diagrams of a running React app,
in the visual language of the julesblom.com parents/owners series. Think
react-scan, but instead of highlighting re-renders it shows the app as the
two trees.

Built on [bippy](https://github.com/aidenybai/bippy) (the fiber-access layer
extracted from react-scan). On every commit, the fiber tree is walked into a
diagrama-style `InputNode` structure (nesting = parent tree, `_debugOwner`
refs = owner tree, `memoizedProps` keys = prop names) and rendered as
indented SVG trees: filled circles for components, hollow for DOM nodes,
solid elbows for tree structure, dashed arcs for owner edges in the parent
tree.

Development builds of React only; owner info is stripped in production.

## Run

```
npm install
npm run dev
```

The demo app (left) uses slot composition so the two trees visibly differ:
`Stats` and the `Post`s sit inside `Frame`'s markup in the parent tree but
hang off `DemoApp` in the owner tree. Hover a node to see its prop names.

## Layout

- `src/extract.ts` — bippy instrumentation, fiber → `InputNode` walker
- `src/render-trees.ts` — `InputNode` → indented SVG (parent + owner views)
- `src/demo/` — demo app the tool observes

## Server components (RSC)

In React 19 dev builds, server components reach the client as
`fiber._debugInfo` chains (they never become fibers). The walker synthesizes
rows for them (`s`-prefixed ids, orange dots), draws a translucent amber
region behind contiguous server rows (the ContextRect convention from the
parent-owners-context post), and tags client components whose owner is a
server component with an italic `'use client'` badge — those are the boundary
entries. `fixtures/next-rsc/` is a minimal Next.js app exercising the
interleaving case: server components slotted through a client boundary, where
parent-tree regions are ragged but the owner tree recovers the slot structure
(`Page` owns `ClientFrame`, `ServerStats`, `ServerList` directly).

The panel's depth button splits the tree across two sheets: server rows
stay on a back "server · early" sheet, client rows come forward onto a
translucent "client · late" sheet offset down-right (nearer = later, the
same depth-means-time convention as the stability figure's cube). It is
one tree, not two — every row keeps its position, so the parent tree
visibly ping-pongs between sheets at the interleaving points, while the
owner tree splits clean: server components form a connected crown at the
root and each 'use client' boundary roots a purely-client subtree.
A crossing edge keeps its elbow in the parent's world, ending at a hollow
ghost marking where the child appears in that world's output — on the back
sheet a deferred client reference (not yet executed), on the front sheet a
server component's slotted output. Amber arrows hop the boundary ghosts
forward, always early-to-late. The whole layout is a lerp driven by one
scalar; owner arcs and the flat amber regions fade out as depth fades in.

The "app only" checkbox scopes both views to the RSC program the app
author wrote: server components plus everything they transitively own
(via owner refs). Framework wrapper components — routers, error and
segment bookkeeping — belong to a different program and drop out, with
kept rows hoisting to their nearest kept ancestor. No-op on pages with
no server rows.

## State dots and React.memo

Components holding state hooks get small red dots stacked above their
circle, one per useState/useReducer (capped at three; the hover title has
the true count, and class component state counts once). React.memo
components sit inside a filled violet disc — containment, not adornment:
memo wraps the component, and the fiber tree agrees (the memo component
is its own fiber), so the shell is runtime structure, not a metaphor.
Owner arcs terminate on the disc rather than at the node: props are
delivered to the comparison gate,
and the function only runs if they changed. Click the ring to show the
fiber's memoizedProps inline, the snapshot the next shallow comparison
runs against; it tracks the live fiber across commits.

## Context areas

Context providers appear as rows (colored name, ring circle) when their
context has a `displayName` — the one runtime signal separating deliberate
user contexts from the anonymous provider stacks libraries wrap everything
in. Set `MyContext.displayName = "MyContext"` to surface yours. Click a
provider row to toggle its area: a tinted rect over the provider's parent
subtree (scope: everything that *can* consume), with the context's current
value as a filled dot at the area's right edge on the provider's row
(labeled with a preview of `memoizedProps.value`), and a delivery line
from the value into each fiber that actually reads it via useContext
(detected from `fiber.dependencies`), ending at the consumer's name — the
published parent-owners-context convention. Areas draw in the parent tree
only, since context scope propagates through the parent tree.

## Suspense and error boundaries

Boundary rows get a colored ring and clickable name (teal Suspense, red
error boundaries — class fibers with getDerivedStateFromError or
componentDidCatch). Clicking one tints its EXCLUSIVE catch region: its
subtree minus the subtrees of nested boundaries of the same kind, so the
tint is exactly the set of components for which that boundary is the
closest one. A nested boundary's own row stays in the outer region, since
a boundary can't catch its own render. Suspense rows showing their
fallback get a `suspended` badge. Parent tree only: throws and suspensions
climb the return path.

Profiler rows are clickable the same way (slate ring, id shown as a
badge): their area is the subtree the profiler's onRender measures. Unlike
catch regions this area is INCLUSIVE — nested Profilers all measure the
same work, so nothing is subtracted. The same split gives the notation a
clean rule: rows that scope something are clickable and have areas;
Fragment and StrictMode don't.

## Activity

`<Activity>` boundaries appear as green clickable rows with a
`hidden`/`visible` badge; clicking one tints its area — the subtree whose
mounting Activity controls (inclusive, like Profiler: a nested Activity
stays under the outer one's control), labelled with the current mode.
Hidden subtrees render at 25% opacity — alive but dormant, which is
Activity's whole pitch. Suspense's internal Offscreen fibers are excluded
so no phantom Activity rows appear inside Suspense boundaries.

## Structural fibers

Fragment, StrictMode, and Profiler get rows too (hollow grey circle, italic
grey name): no function of yours and no DOM node behind them, but React
persists a fiber for each all the same. Renders are cheap and disposable,
fibers are the memory — and the fiber tree holds more than one fiber per
component call. In the owner tree a Fragment shows up as a leaf next to its
children, since the component that rendered `<>...</>` owns the fragment
element and its child elements alike.

## Selection focus

Click any node (circle or name) to focus its neighborhood, Observable-minimap
style: the node, two parents up, two children down, plus its direct owner and
ownees regardless of tree distance — the arc from an owner five rows away
stays at full strength, which is the point. Everything else fades in place;
layout never shifts. Owner arcs follow the same rule as rows: arcs touching the
selection get a heavier stroke, arcs inside the neighborhood draw
normally, and every other arc fades in place to the same strength as the
faded rows — edges recede with the rows they connect, nothing changes
shape on focus. (Whisker stubs and truncated-arc stubs were tried first
and read as noise.) Click again or press Escape to
clear. Selection applies to both trees at once, so the same component's
spatial neighborhood (parent tree) and data-flow neighborhood (owner tree)
sit side by side.

Known limitations: if the selected node's owner sits inside a folded run it
isn't among the rendered rows, so that arc silently disappears
(auto-unfolding the run on selection is the planned fix). And hovering a node's dot now shows the click-to-focus hint
rather than its prop names; props still show on name hover.

## Stability prototype

`stability.html` (`src/stability/`) is the workhorse-figure prototype for
the stability post (see STABILITY.md): the post's running example
(`SearchBox` → `ResultsList`) on the left, and a measured slice-columns
figure on the right. A bippy observer snapshots tracked values per commit
from the fiber side (hook chain for `setQuery`/`results`, child props for
`style`/`onClear`), the figure draws renders as columns, values as rows,
and a horizontal thread where `Object.is` says the reference survived.
The sample component contains no instrumentation; the diagram is a
measurement, not a script. Triggers are derived by diffing state between
snapshots (mount / setQuery / setDark / parent).

Interactions: values that got a new identity flash amber on each commit
(SMIL, plays on DOM insertion, skipped under prefers-reduced-motion), and
an amber × marks each break statically so screenshots keep the story.
Values the current fiber no longer references fade (garbage). The memory
shelf at the right edge shows what the fiber holds now, hooks compartment
vs replaced-every-render compartment. Hover any dot to highlight its full
identity thread; hover values for the actual reference (`<title>`).
Reset remounts the demo and replays from render 1.

The stack button tweens the figure into the durée cube: cards cascade
into depth, newest in front, and since oblique projection is 2D affine
the whole layout is a lerp of the flat and stacked positions driven by
one scalar. Threads rotate into the depth axis for free (their endpoints
move), so an unbroken identity reads as a skewer through the card stack;
break marks float in the gaps between cards. SVG has no z-order, so
stacking is DOM order: strict painter's order per depth (threads into a
card, then its box, then its dots), with translucent card faces (0.75)
so each layer hazes what's behind it instead of erasing it — deeper
history is progressively dimmer, and the skewers stay traceable.
Opaque faces were tried first and hid nearly everything, since the
cascade step is smaller than a card.

In the stacked view a commit plays as motion: the whole history train
recedes one step toward the back, the new card arrives from the near
side (fading in), and the snapshot that slid out of the window fades
out past the back edge. Implemented as a fractional display index
(d = k − 1 + (1 − enter)) so the slide is one motion of the whole
train; the flat view keeps the instant redraw, where the flash carries
the commit event instead.

## Next

- re-render flashes on nodes (marry react-scan's signal with the tree view)
- collapse version of the focus view (breadcrumb spine, folded siblings,
  `[ ]×n` for lists) — the fade-in-place version ships as selection focus
- prop strand counts on owner edges; pass-through highlighting via reference
  equality across fiber levels
- package react-scan-style: npm + `auto.global.js` IIFE that attaches an
  overlay panel to any dev app
