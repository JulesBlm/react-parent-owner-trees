# The renderer emits SVG strings, not DOM nodes or a vdom

`parentTreeSvg`/`ownerTreeSvg` return markup strings. Interactivity is
delegated to the host via `data-*-toggle` attributes and event delegation,
instead of the renderer attaching listeners. This keeps core dependency-free
(ADR-0001), makes figures exportable as-is (copy the string into a post),
and lets any host (React, plain DOM, static build) own its event wiring.
The trade-off: every interaction re-generates the full string, and hosts
duplicate the delegation glue. Accepted — trees are small, and string
output is what makes the published-figure pipeline work.
