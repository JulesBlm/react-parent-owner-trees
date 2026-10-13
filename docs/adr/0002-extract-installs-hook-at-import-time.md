# extract installs the DevTools hook at import time

`extract` calls bippy's `instrument()` as a module side effect, so it must be
imported before react-dom — the DevTools hook has to exist before React
initializes. Lazy installation (call a function when you're ready) was the
alternative, but it misses fibers created before the call and can't hook a
React that already booted. Consequence: an invisible ordering constraint on
import statements; violations fail silently. Any refactor should surface
this constraint as a runtime check rather than remove the side effect.
