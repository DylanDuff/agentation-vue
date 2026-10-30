import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scssModulesPlugin } from "../package-core/build/scss-modules-plugin";
import { preactAliases } from "../package-core/build/preact-aliases";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Builds dist/runtime.js: the toolbar, Preact and the core, bundled. The
// Svelte component is copied as source (scripts/copy-sources.mjs).
export default defineConfig({
  plugins: [
    scssModulesPlugin(),
  ],
  resolve: {
    alias: [
      ...preactAliases,
      { find: /^agentation-element\/mount$/, replacement: fileURLToPath(new URL("../package-element/src/mount.ts", import.meta.url)) },
    ],
  },
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: "src/runtime.ts",
      formats: ["es"],
      fileName: () => "runtime.js",
    },
    sourcemap: true,
    rollupOptions: {
      // The core UI marks its modules "use client" for React Server Components; meaningless here
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" || warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
});
