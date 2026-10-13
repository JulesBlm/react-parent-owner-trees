# Degradation is local and visible

The extraction walk reads undocumented React internals (`_debugOwner`,
`_debugInfo`, hook chains, fiber tags) that shift between versions, so it
WILL meet fibers it cannot describe. The contract, borrowed from
tree-sitter's ERROR nodes: a failure costs exactly its own row, and the row
says so.

**Local**: every fiber visit is individually caught. A throw mid-extraction
produces one placeholder row; the walk continues into its children and past
its siblings. A commit's snapshot is never lost to one bad fiber.

**Visible**: the placeholder renders as an unknown row — hollow diamond (the
circle/square axis answers "your output or React's machinery?", and this
row's honest answer is "can't say"), the raw fiber tag as its name, a title
explaining itself. Quiet per ADR-0005: a failed extraction is information,
not an alarm. Never silently skipped, never guessed at.

Field-level misses stay field-level: no hook names → no strip; unresolvable
owner → row without arc (the composer already skips arcs whose endpoint row
is absent). The contract is pinned by the degradation corpus in
`test/degradation.spec.ts`, written against `serializeTree` — the notation
as text, one line per node — so a regression diffs as a legible tree.
