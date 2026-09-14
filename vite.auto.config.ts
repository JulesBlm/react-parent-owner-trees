import { defineConfig } from "vite";

// Builds the standalone script-tag version: dist/auto.global.js
export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  build: {
    // dist/ is shared with the tsup library build; don't wipe it
    emptyOutDir: false,
    lib: {
      entry: "src/auto.ts",
      name: "ReactTreesTool",
      formats: ["iife"],
      fileName: () => "auto.global.js",
    },
    minify: false,
  },
});
