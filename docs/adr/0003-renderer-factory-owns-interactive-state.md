# The renderer is a per-instance factory owning all interactive state

`createTreeRenderer(options)` returns an instance holding every interactive
toggle (areas, selection, folds, collapses, marks), so several diagrams on
one page never share state. Mutators deliberately do NOT re-render; the
caller re-pulls `parentTreeSvg`/`ownerTreeSvg` when it wants fresh output.
This keeps the renderer host-agnostic — a React figure component, the live
tool's commit loop, and the script-tag IIFE all drive it with their own
render cadence. Module-level state and a reactive/observer design were the
alternatives; both were rejected (shared toggles across figures, and a
framework dependency in core, respectively).
