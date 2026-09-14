Code editors are not very insightful for larger scale structure at a glance.

Think more about the temporal element. 

"Nothing happens between commits; the app just is."

## List

1. Re-render flashes with cause attribution. The highest-value one, and the reason to marry react-scan's signal to your trees. Flash the rows that rendered in each commit, and you'll see cascades follow the dashed owner arcs rather than the solid parent links — the series' core claim, animated by the user's own app. Cause attribution is cheap from fibers: diff memoizedProps against the alternate by reference (which prop changed), check hook state, check context deps. A flashed node labeled parameters tells you "this re-rendered because this prop changed," and the owner arc tells you where that prop came from. Nothing else shows that second part.

   Extension: **the memoization dam** (from the stability convo, see STABILITY.md). The flash wave visibly stops where a React.memo bails out on shallow-equal props (or at a reused element / compiler-memoized component) — the subtree below stays dark, at a glance. Stable references are the precondition for the dam holding, not the dam itself; useMemo alone stops nothing. The failure case is the same picture with one edge different: the dam with a hole, an inline object prop defeating the memo, the wave flowing through. Detectable from fibers: a memo component that bailed out (no flash) vs one that rendered anyway plus which prop's reference changed. Shows the reader why their optimization did nothing.

2. State dots. Your context post's node data already had state: ["count"] as a concept. Runtime: walk fiber.memoizedState hook chains, count useState/useReducer, render the red state dot from your published diagrams. "Where does state actually live" is the question every refactor in the series starts with, and it makes the tool's trees read like the blog's trees.

3. Prop strands and pass-through detection. The current draft post's visualization, live: per-arc prop counts (even just a number on the owner arc before committing to strand rendering), and pass-through highlighting via reference-equality of prop values across consecutive levels. Click a prop, trace its chain, get source-to-surface distance measured on a real app. This turns the post's 17-props diagnosis into something readers can run on their own codebase, which is the strongest possible companion artifact.

Animate props like https://x.com/emilkowalski/status/2090153827835982120

4. The remaining invisible boundaries: Suspense, error boundaries, portals, Activity. This completes the Prugnaud thesis. Suspense fibers (tag 13) as regions showing fallback-vs-content state; error boundaries as regions (class fibers with error lifecycles); portal fibers (tag 4) as an explicit "parent tree lies here, DOM is elsewhere" marker; and Activity boundaries with their hidden/visible mode, which the georeferencer actually uses for its tabs, so you have a live test case. Same region-rect grammar, one more color each. The tool's pitch becomes "every invisible boundary in React, drawn."

5. Compiler memoization marks. bippy exposes hasMemoCache, so you can badge components the React Compiler memoized (plus classic React.memo wrappers, and bailed-out-vs-rendered on each commit). The georeferencer runs the compiler, so this is testable today, and it feeds the draft post's honest-cost section: you'd see whether the compiler actually neutralized the 17-prop re-render cascade, measured rather than argued.

Things I'd deliberately not add: full value inspection (DevTools already does props/state inspection better; hover-titles are enough), and timing/profiling (react-scan and the Profiler own that; this tool's identity is structure, not speed).

On the deferred two, ideas for when you're ready: portals would suit a "teleport" marker — the portal row stays where the parent tree has it, with a small ⤴ glyph and, on click, a dashed curve to a synthesized row showing where its host container actually lives, making "the parent tree lies here" explicit.

6. Suspense multiple WIP trees.

7. RSC tilted isometric view of (owner?) trees, one layer for server, one layer for client

## Durée / time cube

Reference: https://duree.spatial-index.xyz/spatio.html (video frames stacked
as planes along a navigable time axis; Bergson's durée, lived duration vs
clock time). Mac Time Machine is the same idea as navigation chrome.

The crux is temporal: renders form a discrete timeline. Commits are better
material for this than video frames. Sparse, event-driven, every slice
semantically meaningful. Event time, not wall time. Nothing happens between
commits; the app just is.

Stack tree snapshots along z, connect same-id rows across slices, and each
fiber becomes a **strand** through the stack. That is the whole
fibers-are-the-memory thesis in one shape:

- fiber = strand through time
- render = bright dot where a call-wave crossed it
- mount / unmount = where the strand begins / ends
- Stats is one strand with fourteen flashes on it, not fourteen things
- memoized values / dep arrays belong to a particular slice; hover a value,
  highlight the render it came from (from the stability post notes, see
  STABILITY.md — the same cube was invented there independently, 45°-tilted
  renders-over-time)

The projections are the payoff (durée's slit-scan mode hints at this; our
slit-scan is a crisp event chart, not smeary art):

- **Side view = lifeline strip.** Rows = fibers (the existing indented tree
  as y-axis), columns = commits, dot where that fiber rendered, bar spanning
  its lifetime. A piano roll. This is the working analytical view: timeline
  area to the right of the tree, one column per commit, wall-clock gaps as
  thin separators. Render counts are row sums; the re-render flash (idea 1)
  is just the newest column.
- **Front view = Time Machine scrubber.** Click a column, the main tree swaps
  to that snapshot; ghost rows for since-unmounted fibers, tint for
  since-mounted ones.
- **Oblique 3D stack** = the explanatory view. Best home is the blog post as
  a scroll-driven figure that teaches the model in five seconds. As a daily
  debugging surface it fights occlusion for information the side view gives
  flat. (Time Machine only ever made one frame legible either.) Possible
  scrollytelling beat: rotate the cube from 3D intuition to the side-view
  chart the reader will actually use. Relates to idea 7's tilted isometric
  RSC layers.

Technical prerequisites:

- **Ring buffer of commit snapshots** (InputNode[] roots + set of ids that
  rendered + timestamp), last ~50. We already produce the snapshot every
  commit and throw the previous one away. This is the whole data model, and
  it subsumes the flash/counts plan rather than replacing it.
- **Stable row layout across the window.** Snapshots laid out independently
  would wobble: a mount above Feed shifts every strand below it. Fix: global
  row assignment over the buffered window, union of all fibers seen, in tree
  order, fixed y in every slice. Absent fibers leave a gap, and the gap is
  honest: you see the hole where something wasn't alive yet.

StrictMode note: the tool is dev-only and dev StrictMode double-invokes
renders, so the strip will show doubled dots. Decision: show them, it's
truthful. Maybe visually pair the doubled dots rather than deduping.

Build order (revised): ring buffer → lifeline strip. The durée views target
the essays (see STABILITY.md plan; the tool is the design instrument), so
the scrubber and stacked-slices render only get built if an essay needs
them. "Nothing happens between commits" strictly means the *committed* tree
only changes at commits; effects, ref mutations, and discarded concurrent
renders live between them. Suspense/WIP trees deliberately left out for now.