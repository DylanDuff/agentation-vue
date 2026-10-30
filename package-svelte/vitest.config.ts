import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { scssModulesPlugin } from "../package-core/build/scss-modules-plugin";
import { preactAliases } from "../package-core/build/preact-aliases";

const SRC = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  plugins: [
    scssModulesPlugin(),
    svelte({ compilerOptions: { dev: true } }),
    {
      // Agentation.svelte imports the built ./runtime.js; tests use the source.
      // Only for this package: Svelte's internals have a ./runtime.js too.
      name: "agentation-svelte-runtime-source",
      enforce: "pre",
      resolveId(source, importer) {
        if (source === "./runtime.js" && importer?.startsWith(SRC)) return `${SRC}runtime.ts`;
      },
    },
  ],
  resolve: {
    // Svelte's browser build (mount), not its server build
    conditions: ["browser"],
    alias: [
      ...preactAliases,
      { find: /^agentation-element\/mount$/, replacement: fileURLToPath(new URL("../package-element/src/mount.ts", import.meta.url)) },
    ],
  },
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  define: { __VERSION__: JSON.stringify("test") },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
