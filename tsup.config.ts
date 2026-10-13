import { defineConfig } from "tsup";

// Library build: three entry points with strict dependency isolation.
// core must stay import-free; static may import react; extract may import
// bippy. dist/ is shared with the vite auto.global.js build, so no clean.
export default defineConfig({
  entry: {
    core: "src/lib/core/index.ts",
    static: "src/lib/static.ts",
    extract: "src/lib/extract.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: false,
  external: ["react", "react-dom", "bippy"],
});
