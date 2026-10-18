import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error launch-editor ships no types
import launchEditor from "launch-editor";
import { existsSync } from "node:fs";

// Cmd-clicking a row in the tree panel hits this endpoint with the row's
// source location; launch-editor sniffs the editor from running processes.
// Same endpoint shape Vue CLI and Next use.
function openInEditor(): Plugin {
  return {
    name: "open-in-editor",
    configureServer(server) {
      server.middlewares.use("/__open-in-editor", (req, res) => {
        const file = new URL(req.url ?? "", "http://x").searchParams.get(
          "file",
        );
        if (file) {
          // Symbolicated paths arrive filesystem-absolute, as the dev
          // server's /src/... URL path, or sourcemap-relative with the
          // src/ prefix dropped; try the plausible spellings in order.
          const suffix = file.match(/:\d+(:\d+)?$/)?.[0] ?? "";
          const bare = file.slice(0, file.length - suffix.length);
          const candidates = [bare, bare.replace(/^\/+/, ""), `src/${bare.replace(/^\/+/, "")}`];
          const hit = candidates.find((c) => existsSync(c));
          if (hit) launchEditor(hit + suffix);
        }
        res.statusCode = 204;
        res.end();
      });
    },
  };
}

export default defineConfig({
  // retainLines keeps Babel's output on the same lines as the source, so
  // the creation-site stacks in _debugStack carry real line numbers and
  // cmd-click navigation lands where the JSX actually is.
  plugins: [react({ babel: { retainLines: true } }), openInEditor()],
  // dist/ belongs to the published library (tsup + auto.global.js); the
  // demo app build goes elsewhere so vite doesn't empty it. preview.html
  // is the live notation gallery over the test fixtures (/preview.html in
  // dev).
  build: {
    outDir: "dist-app",
    rollupOptions: {
      input: { main: "index.html", preview: "preview.html" },
    },
  },
  // Agent worktrees nest under .claude/ and carry their own copies of the
  // test files; vitest must not glob into them from the main checkout.
  test: { exclude: ["**/node_modules/**", "**/.claude/**"] },
});
