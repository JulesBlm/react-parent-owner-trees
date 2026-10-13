# The renderer is carved into pure passes behind an unchanged interface

core was one 1,500-line closure where every helper read the instance's
toggles and mid-render scratch ambiently. It is now `src/lib/core/` with the
factory (`renderer.ts`) as the only stateful module: the pure passes
(transform, edges, rows, areas, compose) receive a `RenderState` — a live
readonly view over the factory's sets, reassigned primitives surfaced
through getters — and the old scratch channels became return values
(`ownerArcPath` returns its left extent, `nodeMarkup` returns its expanded
hook overlay). Context colors are the one persistent collaborator: the
factory owns the name→color map and `compose` runs the assignment pre-pass
in row order, so slot choice never depends on paint order. The published
`core` entry (`index.ts` barrel) is unchanged; everything below it is
internal seams, used by tests. The carve is guarded by characterization
snapshots (`test/renderer.spec.ts`) that the split kept byte-identical —
alternatives considered and rejected: defensive per-render state snapshots
(needless allocation per commit) and per-field parameter threading (the
interface balloons to the width of the state it was hiding).
