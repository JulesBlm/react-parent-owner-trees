# Stability post

Title candidates (Sept 2026 grill): "What 'stable' actually means in
React" (slight favorite: definition-shaped, matches what a confused
reader searches) or "A visual guide to Stability in React"; whichever
loses can be the subtitle. "The Stabilizer Hooks" demoted to the beat 6
section heading.

Visual guide to value stability in React. Aim: explain it so well it ends the
discussion, the de facto reference post.

Scope discipline (from the Apr–Aug Claude convo): stability, prop flow, and
dependencies are three different visualizations. Don't bundle them. One
concept, one visual mechanism, one reader transformation: "after reading
this, you can look at any React component and see which values survive a
render and which don't." The notation is the vehicle, never the subject.

## Plan

Order settled (Sept 2026 grill): **stability post first.** It uses no
tree notation and has zero dependency on the tool post. The tool/notation
post comes whenever; its screenshots only get better as the tool improves.
Framing revised (Sept 8): Jules chose **notation-first** after all, a
brief introduction titled "Parent-owner trees: a visual formalism for
React apps" (nod to Harel's statecharts paper), notation shown first,
Handoff decided (Sept 2026): the notation post closes on a glimpse of
THIS post's figure, an identity thread breaking between two renders,
cliffhanger not table of contents. This post opens from that exact
image. Also an outside data point from a side thread, recorded not
adopted: isometric/stacked views were argued to fail past four layers.
That thread had not seen the built cube (translucent faces, painter's
order), which addresses the occlusion it worried about; judge on the
prototype, not the argument.

Citation candidate (Sept 2026): Larkin & Simon 1987, reduced
labeling. "Is this the same object as last render" is label matching,
the most error-prone inference in the language; the identity thread
replaces it with a perceptual judgment, is the line continuous. The
figure's whole argument in their vocabulary.

then the tool. Full draft (skeleton beats merged with the built
glossary) at jules-next-pages content/react-visual-formalism/index.mdx;
the drafts folder is deleted. The dam follow-up post
inherits the tree grammar and the tool. No deep Suspense treatment
anywhere; it adds complexity without serving the thesis.

The durée visualizations live in the essays. The tool builds only what's
needed to design and capture those figures (ring buffer + lifeline strip;
scrubber and 3D stack only if an essay needs them).

## Draft outline (v1, Sept 2026)

Opening chosen: personal framing (the blog explains React's implicit parts;
parent-vs-owner, flushing) → the MacWright quote → "yes! fundamental yet
brushed over; people drop 'stable' casually without explaining it, me
included." This gives the post its spine: MacWright names a documentation
hole, the post is the missing page, drawn. Each beat ends on the question
the next answers.

1. The undocumented word (the opening above). Then the word-salad beat:
   when people DO explain stability, it comes out like "Hooks aren't
   stable by default. useMemo will only be effective as long as data is
   also a stable reference" — true, and noise to anyone without the model
   already in their head. Not bad writing; the wrong medium at its
   ceiling (identity is a relation across time, prose describes one
   moment at a time). Visualizing it is the fix: the claim is that the
   figures make this INTUITIVE, not just documented. End on the contract:
   after this post you can look at any component and see which values
   survive a render and which don't.
2. "Stable" = the same value as last render. Same by what standard?
   Identity, not equality. Object.is, literals never equal twice. The
   "identity in 90 seconds" compression of the old JS part. Introduce the
   identity-thread figure here on plain JS: two moments side by side,
   thread intact vs broken.
3. Why identities keep breaking: components are functions React calls
   again. Render = call, fresh local values, everything redefined. The
   reframe doing the most work in the post: instability is the DEFAULT;
   stability is something you arrange, not something values have.
   THE WORKHORSE FIGURE lives here: render slices as columns, each slice
   holding the values created during that call (`style`, `onClick`),
   fresh identity per slice, thread broken between slices. This is the
   values-evaluated-per-call picture. Execution-context decision: explain
   the concept (a call is a box; values born in it die with it), never
   use the term — "function execution context" is itself word salad and
   would undermine beat 1. At most a parenthetical "(the spec calls this
   an execution context)". The figure teaches what the term means.
4. What survives: hooks are React's memory. The two shelves. EXTEND the
   beat-3 figure rather than drawing a new one: hooks reach out of the
   disposable slice to the persistent React-side shelf. "Renders are
   cheap and disposable, fibers are the memory."
5. The stable-by-default inventory: setters, dispatch, the ref object.
   Pays off MacWright directly; the literal missing documentation, as a
   figure. The section people will link to.
6. The stabilizer hooks in Shevlin's order: useRef > useMemo > useCallback
   (useMemo for functions). Each drawn as its thread behavior.
7. The fine print: useMemo not a semantic guarantee (TkDodo), memoized
   values belong to a render (hover figure), stale closures as ghosts —
   a value from an old slice still being read completes the
   execution-context concept from beat 3 without ever naming it.
8. Dep arrays: proving nothing changed. THE CLIMAX. Two-step loop. Deps
   compared BY IDENTITY, closing the circle: stability is viral, one
   unstable value poisons everything derived from it. Climax figure is
   MacWright's exact scenario drawn: inline handler in useEffect deps,
   thread broken every column, effect firing every slice; then the
   stabilized version, thread intact, effect fires once. The opening
   complaint, answered as a picture.
9. The compiler: defuse "isn't this obsolete?" in one tight section (the
   compiler auto-stabilizes; understanding identity tells you what it
   memoized and when it bails).
10. Close: back to MacWright, and the word-salad bookend: quote the exact
    sentence from beat 1 again. First read, the reader bounced off it;
    now it reads as trivially true, one clause per figure element. The
    reader transformation, measured on the reader, in the post. The extra
    rules of hooks were never in the docs; now they're at least in a
    picture.

CUT (Sept 2026 grill): the memoization dam / wave / tree view moved to
its own follow-up post. It forced introducing the whole tree grammar and
value propagation at the climax of an already-long post. Consequence:
this post uses NO tree notation at all, zero dependency on the prequel
tool post. "useMemo alone stops nothing" and the three-channels material
move with it.

Structural choices: deps beat goes last as the climax, answering the
opening MacWright complaint (a circle, not a summary); beat 3 gets room
(once the reader believes instability is the default, the stabilizer
hooks become obvious countermeasures instead of arbitrary API).

### Figure decisions (grill session, Sept 2026)

- Hand-crafted SVG/React figures in the blog's visual language; the tool
  is a reality-check reference, not a figure factory. Interactivity
  sparingly, where it pays.
- ONE running example component through the whole post (SearchBox →
  ResultsList shape: useState value+setter, inline object, inline
  handler, one memoized value, one child receiving props). Introduced
  beat 3, reused through beat 8. Escape hatches: beat 2 is pre-React
  plain JS; fine print may use two-line fragments. The example also runs
  LIVE next to its figure with a re-render button: reader clicks, the
  real component updates, threads break in the diagram.
- Flat slice-columns are the universal grammar: renders as columns,
  values as rows, dot per slice, horizontal thread = same reference,
  broken thread = new identity.
- The live figure MEASURES the running example, it doesn't act out a
  script. Instrumentation via bippy observing from the fiber side, so
  the sample code in the post is exactly the code running (no logging
  hook polluting it). Coverage checks out: results/setCount in the hook
  chain, onClick as child prop, style as host prop; snapshot per commit,
  Object.is across snapshots. Costs: bippy's hook is global and must
  install before react-dom (beforeInteractive script, react-scan
  pattern), load only on this post's page, filter commits to the demo
  subtree. Fallback if the plumbing fights the blog: a ~20-line
  useRenderLog hook, hidden but linked as full source. The bippy
  observer module is reusable and required anyway for the dam post
  (memo bailouts, which-prop-changed are fiber-side facts). Authored
  figures (beat 2 plain JS, the rotation) stay scripted; they teach
  geometry, they don't report facts.
- Build order: (1) the beat 3 workhorse artifact as a standalone
  prototype (running example + bippy observer + static slice-columns),
  iterate until the threads read effortlessly — this is the post's whole
  technical risk in one artifact — DONE Sept 2026, `stability.html` +
  `src/stability/` in this repo, verified live (setQuery threads all
  gaps, results holds across setDark/parent commits, style/onClear
  isolated dots); (2) full prose draft front to back
  with figure placeholders; (3) remaining figures built against the
  actual sentences they support; (4) the cube→flat rotation last.
- The isometric durée cube appears ONCE, in the figure that introduces
  the time axis: starts as the cube (depth encodes pastness, only the
  front plane is current), then rotates into the flat slice-columns and
  stays flat forever after. The rotation legitimizes the flat chart.
- Rotation implementation: no real 3D. Oblique projection is a 2D affine
  transform; tween one scalar t (0 = stacked/skewed/depth-faded, 1 =
  identity matrices side by side), rebuild each column's matrix from
  parameters per frame (never lerp matrices component-wise). Driver:
  motion (framer-motion) spring on t, scroll-into-view trigger + replay
  button. Avoid CSS 3D on SVG children (Safari). Stretch goal with
  static fallback (cube image + flat figure below); build all flat
  figures first, rotation prototype last.

## Thesis

- "Stability" is part of the **meta language** of React (Cheng Lou,
  [Taming the Meta Language](https://www.youtube.com/watch?v=_0T5OSSzxms),
  ReactConf 2017; breakdown at [frantic.im/meta-language](http://frantic.im/meta-language)).
  The source code can only convey so much; the norms around it are meta
  language. Stability is never in the code you read, only in the norms.
- React doesn't document stability at all. Tom MacWright,
  [The extra rules of hooks](https://macwright.com/2024/09/19/the-extra-rules-of-hooks):
  nothing in the `setState` docs says the setter is stable between renders,
  nothing in the `useEffect` docs says refs can be omitted from deps.
- People fail to realize components are just functions that React calls over
  and over to produce new UI. The inside values don't stick around, that's why
  we need hooks.
- Hooks have had a literacy problem for years. I used to think it was a
  documentation problem; now I lean toward design kink. Value stability is
  hard to keep track of in your head. Not undoable, but it requires
  understanding and discipline.
- Theory: viewing React codebases as files, without the underlying structure
  revealed visually, is a cognitive bottleneck. Files impose the view.
  (This is the react-trees-tool thesis; see IDEAS.md.) The version with
  teeth: **code shows you one component at a time; the structure that
  matters lives between components.**
- Possible opening beat, "the next indent": code is already secretly a
  visualization. Indentation is a tree diagram rotated 90 degrees, syntax
  highlighting is a categorical color encoding, monospace is a grid, line
  breaks are spatial chunking. None of it is in the language spec; it all
  accreted because raw text is too flat for the brain. We stopped at a
  local maximum. This notation is the next indent, not a novel proposal.
  Defuses "why not just read the code" before it's raised.
- Why prose fails at stability specifically: identity is a relation across
  time. "This object is the same object as last render" compares two
  moments, and text describes one moment at a time. The reader holds three
  temporal states in working memory to parse one sentence. A visual shows
  render 1 and render 2 side by side with the identity link intact or
  broken. That's a perceptual shortcut around a working-memory limit, the
  actual "oh" moment.
- Stability is a **propagation phenomenon**, not a temporal property of one
  value. State changes at some node, its derived values get fresh
  references, those flow down as props, children's derived values break
  identity in turn, and the wave keeps going. The cause is four components
  up. That's why it needs both the tree axis and the time axis, and why
  tracking it mentally is so hard.

## Outline, part 1: JavaScript

1. Identity vs equality. Objects are only ever equal to themselves, even when
   they hold the same values. `Object.is`. Object literals are never equal.
2. Function scope.
3. Function execution contexts (call stack). Variables are scoped to
   functions; when the function is called again, they are defined again.
4. Purity. Nothing outside the execution context changes while it runs.
   ("Scope is about structure, execution contexts are about behavior, purity
   is fundamentally about behavior.")
5. Repeated function calls. Introduce the timeline here, with plain
   functions.
6. Nested function execution contexts (a FEC created from within a FEC).
7. Closures. Ghost values of previous function calls. Timeline again.

## Outline, part 2: React

1. React components are functions. It is not up to you to call them; React
   does that when it needs to update the UI. That call is a render.
2. Rendering is React calling your functions, a tree of function calls.
3. Updates. "At its core, React is essentially a library for processing a
   queue of state updates to produce consistent UIs."
   ([Concurrent React for Library Maintainers](https://github.com/reactwg/react-18/discussions/70))
4. Hooks plug into React to give a function special powers. One power is
   remembering values between calls, i.e. between renders.
5. The stabilizer hooks. Ordered by ease of use / automaticness following
   Kyle Shevlin's [four-hook division](https://kyleshevlin.com/comparing-use-ref-and-use-state):
   useRef > useMemo > useCallback.
6. Dependency lists are arrays passed to hooks to avoid doing work. Proving
   that nothing has changed. React thinks: "I'll hold on to this value,
   compare these dependencies every render, and only recompute when they
   change." Hence: deps need stable values.

## Key points to land

- State setters and dispatch are always stable (and undocumented as such).
- `useMemo` is a performance optimization, **not a semantic guarantee**.
  React may forget memoized values. For true referential stability, use
  un-destructured `useState` with a lazy initializer
  ([TkDodo, useState for one-time initializations](https://tkdodo.eu/blog/use-state-for-one-time-initializations)).
- Memoized values belong to a particular render. Show it, don't say it.
- If you declare a function or constant in module scope, it sticks around.
- Consistency is one of the hardest problems in UI; staleness is the failure
  mode ([Dan Abramov, Elements of UI Engineering](https://overreacted.io/the-elements-of-ui-engineering/)).

## Visualization spec

- **Identity threads are the core encoding.** Same reference between render
  n and n+1 = an unbroken thread across the time axis. New reference = the
  thread breaks and a new one starts. Everything else in the notation is
  scaffolding for that one visual predicate. Design this first.
- **The memoization dam** (the money shot). A state tick sends a re-render
  wavefront down the tree; by default it hits everything below. The only
  actual dams are React.memo (bails out on shallow-equal props), element
  reference reuse (hoisted JSX, the children/slot pattern), and
  compiler-inserted memoization. Stable references (useMemo, useCallback,
  setState identity) are the *precondition* for a dam holding, not dams
  themselves. useMemo alone stops nothing, which is itself the most common
  stability misconception and deserves its own figure. The failure case is
  the same diagram with one edge different: the dam with a hole, where an
  inline object prop defeats the memo and the wave flows through. The
  reader sees why their optimization did nothing. Live-demonstrable in
  react-trees-tool once the commit ring buffer exists.
- The wave has three channels, and they follow different trees: prop waves
  follow the owner tree, context waves follow the parent tree and punch
  straight through memo dams, store subscriptions don't travel at all,
  they teleport directly to subscribers. The dam figure depicts the props
  channel; say so, or readers can't explain why their memoized component
  re-rendered from a context change.
- Renders as trees over time on an ordinal axis (per render), tilted 45
  degrees, old renders receding into the screen. Old render's JSX fades out
  but its dep arrays and memoized values are held. This is the durée time
  cube (see IDEAS.md in this repo); the stability post and the cube share
  the figure.
- Isometric caveats: readability degrades past 3–4 layers (occlusion, depth
  ambiguity, skewed text), and hover targets in sheared space are painful.
  The flat alternative: tree vertical, time horizontal, identity threads
  running left to right like a storyline chart. Unlimited render steps,
  readable text, trivial interaction. Isometric for the hero figure, flat
  for the working diagrams. (Same conclusion as the durée side view.)
- Ordinal time is a point worth making explicitly in the essay: React has
  no continuous time, only discrete commits. A wall-clock axis would be a
  lie.
- Show that memoized values belong to a particular render: a box of
  memoized values on the React side; hover a value to highlight the render
  slice it belongs to.
- Dependency comparison as a two-step loop: (1) compare deps, (2) return
  held value or run the callback.
- JS memory shelves: one shelf for React hook values (dep arrays, refs,
  state and setters) that persist, one shelf for values calculated during
  render, garbage collected once the element is produced. "Renders are
  cheap and disposable, fibers are the memory."
- Closures as ghost values of past function calls on the timeline. Stale
  closure = a dot on an old slice still being read from the newest one.

## Quotes worth using

- Charlie Munger on graphs: "The graph puts number into a form that looks
  like motion. So it's using some of this primitive neural stuff in your
  system in a way that helps you understand." React code is number-soup the
  brain is lousy at; the notation converts it into something the visual
  system can grasp. Candidate essay opening; sets a
  thinking-about-thinking register.
- Mike Bostock: "A tool for thought, rather than a better mousetrap...
  visualization revolves around human perception and cognition... The
  reader doesn't need a PhD to see the value. ... As Don Norman says, it
  makes us smart."
  https://observablehq.com/@observablehq/future-of-data-work-q-a-with-mike-bostock
- Mark Erikson on fiber: "React's internal data structure that represents
  the actual component tree **at a point in time**." (The durée thesis in
  nine words.)
- From [this fiber thread](https://x.com/infinterenders/status/1997359890021634509),
  two metaphors: fiber as a hand-rolled call stack freed from the JS
  engine's stack (recursion isn't interruptible, so React built its own
  stack as a linked structure), and the double-buffered current/WIP trees
  as a game engine drawing to a hidden buffer and flipping it, which is why
  you never see half-updated UI.

## The compiler

- Address "isn't this obsolete?" head-on or it'll be the top comment. The
  React Compiler auto-memoizes, but identity semantics don't go away; the
  compiler makes understanding stability *more* valuable because now you
  need to know what it memoized and when it bails out. Less-visible
  mechanisms are exactly what visual explanation is for.
- Demo consequence: a compiled app is a wall of dams where the wave barely
  propagates (the georeferencer runs the compiler, so it's the "after"
  picture). The dam figure itself wants a hand-crafted, non-compiled
  example. Compiler memoization marks in the tool are IDEAS.md idea 5.

## Scope cuts

Keep it small. Cut: Execute Program style checkpoint tests, the feedback
questionnaire. The JS part (part 1) compresses to a short "identity in 90
seconds" refresher rather than seven chapters; the post is about React.

## Follow-up posts

- The memoization dam (cut from the stability post, Sept 2026): re-render
  propagation, the wave and the tree, why your memo does nothing.
  "useMemo alone stops nothing" and the three-channels material live
  here. This is where the tree notation and the tool earn their keep.
- useLessCallback.
- Stale deps, don't cheat the linter.
- Event handlers close over hook values.
- Needless effect timelines / updates.

## Prior art / references

- Pomber's diagrams, Alex Sidorenko's animations.
- Observable's [minimap](https://old.observablehq.com/documentation/debugging/minimap):
  cells form a DAG, clicking a cell highlights its relations. Prior art for
  click-to-highlight and gradual reveal. React is a tree, Observable is a
  DAG. Specifics worth stealing: one level of connections at a time with
  "whiskers" hinting transitive deps (the anti-hairball move for prop
  strands); cells arranged by dataflow order regardless of document order
  (the owner-tree move); per-cell symbols encoding relationship role
  (references / referenced / mutual / isolated / error); and a plainly
  stated limitation, "it only knows about static references," which a
  runtime tool like react-trees-tool dodges. Worth a sentence in post 1.
- natto.dev (Paul Shen), xstate: computational-medium ideas with limited
  reception.
