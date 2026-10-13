# Future types

Fiber tags the extraction walk neither names nor errors on: today they pass
through silently, children attaching to the nearest included ancestor
(`collectChildren`'s else branch). Most are experimental and appear only in
canary builds, so the pass-through currently costs nothing — but each is a
candidate to ship stable, and ADR-0007 leaves an open question hanging over
all of them: pass-through means a newly stable tag *vanishes* from diagrams
rather than showing an honest unknown row. The alternative is an allowlist
("these tags are passed through on purpose; anything else gets the
diamond"), at the cost of diamonds for harmless internals on canary builds.
Decision deferred until one of these actually ships stable.

Status notes are as of October 2026, React 19.3.

A caution about tag numbers in general: they are an undocumented table that
React renumbers at will and downstream tooling copies imperfectly — bippy
0.5.43 exports `ActivityComponentTag = 28`, but in React's ReactWorkTags 28
is IncompleteFunctionComponent and Activity is 31 (what extract.ts uses).
Trust React's source over any re-export, and keep tag constants local.
The upstream-facing half of these findings (bippy bug report and
contribution proposals) lives in BIPPY.md.

## Would deserve notation

**SuspenseList** (tag 19):
Experimental since ~2019, works in canary, not stable. Coordinates the
Suspense boundaries beneath it: `revealOrder` forces resolution order
(forwards/backwards/together) instead of pop-in-when-ready, and
`tail="collapsed"` caps visible fallbacks. A boundary *about other
boundaries* — its area would be the set of Suspense boundaries it
choreographs, a scope over scopes with no current equivalent in the
notation. Square glyph when it lands; the area design is the real work.

**Cache** (tag 24):
Experimental, client-only. Scopes a cache pool for suspending reads: data
cached inside the boundary lives, dies, and refreshes with that subtree.
Not the stable React 19 `cache()` API — that one is server-side per-request
memoization and never creates fibers. If it ships, it is a scope row
(area = whose reads hit this pool), closest cousin to the context area.

**DehydratedFragment** (tag 18):
Meetable today in SSR apps: a server-rendered subtree React has adopted
lazily and not yet hydrated — exists in the DOM, no client fibers behind it
yet. A genuine new species for the notation's mounted-ness vocabulary:
kin to *potential* (declared, not mounted) and *dormant* (alive, not
shown), but inverted — DOM exists, component instances don't. Worth a row
the moment the tool meets one in the wild.

## Already handled, recording how

**HostHoistable** (tag 26) / **HostSingleton** (tag 27):
Stable in React 19: the special handling of `<link>`/`<meta>`/`<style>`
(hoisted to head) and `<html>`/`<head>`/`<body>` (singletons). Verified
against bippy 0.5.43: `isHostFiber` matches tags 5, 26, and 27, so both
appear as ordinary dom rows. (Hoisting means a HostHoistable's row sits
where it was *rendered*, not where its DOM node landed — same honest
placement the notation already uses for portals, minus the badge.)

## Pass-through is correct, recording why

**HostText** (tag 6): text nodes — one row per text run would be pure
noise; the parent host row carries the information.

**ContextConsumer** (tag 9) and anonymous providers (tag 10 without
`displayName`): the consumer relation is already drawn as delivery lines
into the reading component; a consumer fiber row would duplicate it.
Anonymous providers are the library-internal wrapping the displayName
filter exists to drop (see extract.ts context detection).

**OffscreenComponent** (tag 22) in its internal uses: Suspense and
Activity implementation detail; the boundary row above it already tells
the story (`isActivityFiber` separates the one case where it IS the
story).

**LegacyHidden** (tag 23), **Scope** (tag 21), **TracingMarker** (tag 25):
internal/legacy machinery with no author-facing component; nothing for a
reader to recognize.

**IncompleteClassComponent** (tag 17) / **IncompleteFunctionComponent**
(tag 28) / **Throw** (tag 29): mid-error render states; the error-boundary
vocabulary (*caught*, *departed*) covers what a reader needs.
