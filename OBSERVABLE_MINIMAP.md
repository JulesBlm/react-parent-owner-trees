# Lessons from Observable's Visual Dataflow

Observable's minimap solves a cousin of this tool's problem: a hidden graph
(reactive cell references) that users consistently mis-model as the visible
order (top-to-bottom cells), made legible without a separate "graph view."
That is the owner-tree/parent-tree situation almost exactly. This doc
collects what transfers — the design philosophy, the glyph grammar, concrete
feature ideas, and the failure catalog from their forum feedback.

Sources:

- [Introducing Visual Dataflow](https://observablehq.com/@observablehq/introducing-visual-dataflow)
- [Minimap](https://observablehq.com/@observablehq/minimap)
- [Forum: Visual Dataflow](https://talk.observablehq.com/t/visual-dataflow/2976)

Status: the **blink** (ambient per-commit liveness) and **page
highlighting** (the second coordinated surface) shipped from this list.
Everything else is unscheduled — ideas to think about, not a backlog.

## The deepest alignment

Observable concluded the fix for "magic" was NOT a comprehensive graph
visualization. Mike and Tom built full dependency-graph notebooks; the
product shipped the restrained minimap instead. Their stated principles:

> The design of the minimap is deliberately restrained: it only lights up
> when you express the intent to edit by focusing a cell, and it only
> highlights the directly connected cells. … We wanted something
> unobtrusive enough that it can sit ambiently in the corner — where a new
> user can see it without toggling any hidden option, and an experienced
> user can ignore it in their peripheral vision.

> We tried to make it fast, clear, and stable — not comprehensive.

This tool is similarly positioned against "just look at the fiber tree"
maximalism: the notation wins by showing the one relation that corrects the
misconception (owner ≠ parent), at the moment of intent, and staying quiet
otherwise. Their restraint validates selection focus, the fold, and the
salience rule — and "fast, clear, stable — not comprehensive" is worth
keeping as a tiebreaker when a feature wants to draw more.

A corollary from their gallery: *cells without names or references appear
smaller.* Inert things shrink; they aren't hidden. Same instinct as
structural rows' quiet gray and the fold's ×n.

## The feature exists to contradict a false expectation

The whole minimap teaches one correction: data does not flow top-to-bottom
in a notebook; a definition can sit below its reference. They keep both
orders readable *simultaneously* — vertical position stays document order,
horizontal position carries dataflow order — and nothing moves on focus.
This tool's equivalent split: indentation carries the parent tree, arcs
carry the owner tree, and layout never shifts on selection.

Two of their gallery captions are *negative* claims:

- "This cell is calling `chart.update` but *won't* re-run `chart`"
- "Reordering cells does not change inputs or outputs"

Showing what won't happen is a first-class message; the tool earns trust by
visualizing non-propagation. The memo disc is already this (the arc ends at
the comparison gate, not the component). Worth asking of every figure: what
is the false expectation this view should visibly contradict? For the owner
tree it's "nesting = who re-renders whom"; a figure where an owner arc skips
past intermediate parents is the `chart.update` moment.

## Glyph grammar

The minimap's entire legend is one dot plus two optional stubs:

| primitive | meaning |
| --- | --- |
| left stub | refers to something (consumes) |
| right stub | is referenced by something (is consumed) |
| small dot | unnamed and unconnected — can't participate |
| red | error |
| blue | focused connections |
| gray | everything at rest |

Lessons in that economy:

- **Fixed port sides.** Inputs always enter on the left, outputs always
  leave on the right, like a schematic symbol — so every wire's direction is
  legible with no arrowheads, even where wires overlap. Owner arcs could
  borrow the discipline: if arcs always depart and land at consistent
  anchors on the row (the memo disc is already one such landing site),
  direction stays readable without arrowheads.
- **One relation, one geometry.** Their wires are orthogonal elbows — the
  same word, the same H-V-H routing as this notation's parent-tree elbows.
  They get away with a single edge geometry because they have a single
  relation. This tool overlays two relations on one canvas, which is exactly
  why the solid-elbow vs dashed-arc split earns its keep: geometry, not just
  dash pattern or color, should be the primary discriminator.
- **Per-view color budget of three.** Gray resting, blue focused, red
  error. Category is carried entirely by shape, size, and position; hue
  answers one question. This notation's palette is necessarily larger
  (server color, memo violet, boundary colors, amber breaks), but the
  per-figure discipline holds: within one view, audit what each hue is
  answering.
- **Errors reuse the normal grammar in the alarm color.** The circular
  definition error is the same elbow wire, closed into a loop, in red — no
  new glyph. Matches how departed/potential reuse row grammar with dashes
  and dimming.

## Caption consequences, not encodings

The legend never describes ink. Not "this cell has no references" but *"if
you delete it, nothing else will break."* Not "edge from A to B" but *"the
second will re-run when the first does, and break if the first is
deleted."* Every glyph is taught as a prediction about behavior.

Apply to the glossary figures: caption the owner arc as "who re-runs when
this re-renders," the catch region as "the rows this boundary will catch
for," the memo disc as "props stop here unless they changed" — rather than
describing the mark.

## Ideas not yet built

### Resting-state whiskers

Unfocused minimap dots carry tiny stubs showing *that* connections exist
before you ask. The analog here: a minimal mark on rows whose owner-edge
counterpart is currently invisible — folded away, collapsed, or scrolled
off. Right now a fold or collapse can silently swallow one end of the
relation the tool exists to show. A whisker-grade mark ("this row has an
owner relationship you can't currently see") is cheap salience that tracks
genuine importance.

Open questions: which invisibility cases matter (fold, collapse, offscreen,
view-filtered)? Does the whisker point toward the hidden endpoint? Does it
appear on both severed ends or only the visible one?

### One level of wires, a handle to continue

When `c` is focused, the minimap draws a wire only to `b`; `a` (transitive)
shifts left with *no* wire, and `b` grows a small clickable whisker to
trace one more hop. They explicitly refused to draw the transitive closure.

Selection focus already limits to direct owner/ownees. The refinement is
the continuation affordance: from the focused neighborhood, a small handle
on the direct owner to walk one more hop, rather than flooding the diagram
or dead-ending. Notably the transitive whisker is **gray, not blue** — a
third salience tier between "focused" and "resting": connected beyond
what's drawn, click to continue. Selection focus currently has two tiers
(full strength / `FADE`); this would add a middle one.

Open questions: does walking a hop move the selection or extend the
neighborhood? How does it read in the owner tree, where the direct owner is
already the parent?

### State the blindness

The minimap docs say plainly: it only knows *static* references; mutation
and side effects are invisible — and that limitation is part of why they
discourage mutation. The equivalent disclosure here: owner edges come from
owner refs; portals, external stores, and event-driven effects are edges
the notation can't see. (Context the tool *does* see, via delivery lines —
already ahead of their static analysis.) Saying the limitation out loud in
the README/glossary prevents the tool from over-claiming.

### Read the owner tree as the render schedule

"Following the line from left to right, you see the order in which data
flows through your notebook, **and the order in which cells will run**."
The minimap doubles as an execution schedule. The owner tree has the same
dual reading — simultaneously "who rendered whom" and the causal order of a
commit. Possibly worth a line in CONTEXT.md or a glossary figure framing:
the owner tree is the commit's render schedule.

## Shipped: page highlighting

The feature everyone remembers about Visual Dataflow is the minimap, but
what made it work was the pair: references got a blue underline **in the
code editor itself**, and the minimap wire plugged in as you typed. The
lesson isn't "add an overview widget" — it's that the notation reached into
the user's own artifact, so the abstract view and the thing being described
confirmed each other.

The analog shipped 2026-10-13: while a row is selected, the DOM region its
output governs is outlined in the running app (`createPageHighlighter` +
`getNodeHostElements`, both on the extract entry). The parent tree's whole
claim is "where each node's output sits in the markup"; the outline lets a
row prove that claim by pointing at its pixels. Restraint rules carried
over: selection-triggered only (no hover-spray), one quiet color
(Observable's own wire blue, `#3b5fc0`, as a nod), fixed-position boxes
that never affect page layout, re-resolved every commit so remounts stay
tracked. Rows with nothing on the page — ghosts, departed, hidden Activity
subtrees — honestly outline nothing. See **Page highlight** in CONTEXT.md.

The loop's other half already existed (cmd-click row → source file); a
possible third arc is the reverse direction — alt-hover an element in the
page to flash its row — which is unbuilt and should stay quiet if built.

## Shipped: the blink

Minimap dots pulse subtly each time a cell runs; the editor margin flashes
gray on re-evaluation. The analog shipped 2026-10-13: rows that performed
work in a commit (bippy `traverseRenderedFibers` — actual renders, never
bailed-out reconciliation visits) get a one-shot fading halo. Per-call
data, consume-once in the panel, so interaction re-renders never replay it.
See **Blink** in CONTEXT.md.

One thing to watch in real use: the mount commit blinks everything once on
load. Observable does the same; if it reads as noise rather than
orientation, suppressing the first snapshot's set is one `if`.

## Forum failure catalog

Small failures from their feedback thread worth pre-empting:

- **Reference styling was too heavy.** The blue *background* on in-code
  cell references drew complaints; Observable retreated to a gentle
  underline. When a mark is everywhere, it must whisper — the salience rule
  applied to someone else's regret.
- **No obvious exit from dependency-viewing mode.** Selection focus needs
  unmistakable ways out — click-away, Esc, re-click the focused row. (All
  three exist as of 2026-10-13; click-away exempts form controls, and a
  click-away with nothing selected is a true no-op — no re-render.)
- **One click, one effect.** Clicking a cell name both navigated *and*
  force-expanded the code editor, which annoyed people. Focus and collapse
  must never share a gesture ambiguously.
- **De-emphasize the inert.** Users asked for non-reactive markdown cells
  to recede. Shrink or fold the unimportant rather than making users ask.
- **Don't truncate while space remains.** Cell names ellipsized at 100px
  despite available room. Give row names the space that exists first.
- **Proportional scrolling annoyed on long notebooks.** If the diagram ever
  gets its own overview strip, test it on deep trees before shipping.
