# Three entry points; core never imports bippy or react

The package publishes `core` (InputNode + renderer), `static` (element
walker, peer: react), and `extract` (fiber instrumentation, peers: bippy +
react) as separate entry points so that diagram generation never requires
bippy. Figures can be rendered at SSG time or in production builds where
bippy either can't run or shouldn't ship. The cost — producers can't share
code *through* core unless that code is dependency-free — is accepted;
shared producer utilities must themselves be zero-dep to live in core.
