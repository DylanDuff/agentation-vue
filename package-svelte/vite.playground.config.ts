import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { scssModulesPlugin } from "../package-core/build/scss-modules-plugin";
import { preactAliases } from "../package-core/build/preact-aliases";

const SRC = fileURLToPath(new URL("./src/", import.meta.url));

// Runs the component from source: ./runtime.js resolves to src/runtime.ts
export default defineConfig({
  root: "playground",
  plugins: [
    scssModulesPlugin(),
    svelte(),
    {
      name: "agentation-svelte-runtime-source",
      enforce: "pre",
      resolveId(source, importer) {
        if (source === "./runtime.js" && importer?.startsWith(SRC)) return `${SRC}runtime.ts`;
      },
    },
  ],
  resolve: {
    alias: [
      ...preactAliases,
      { find: /^agentation-element\/mount$/, replacement: fileURLToPath(new URL("../package-element/src/mount.ts", import.meta.url)) },
    ],
  },
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  define: { __VERSION__: JSON.stringify("dev") },
});
