import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { preactAliases } from "../package-core/build/preact-aliases";

// Runs the core toolbar test suite (written for React) with Preact in React's
// place: the renderer the custom element, Vue and Svelte packages ship.
const shim = fileURLToPath(new URL("./test/testing-library-preact.ts", import.meta.url));
const setup = fileURLToPath(new URL("./test/setup.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [...preactAliases, { find: /^@testing-library\/react$/, replacement: shim }],
  },
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  define: { __VERSION__: JSON.stringify("test") },
  test: {
    root: "../package-core",
    include: ["src/ui/**/*.test.tsx"],
    environment: "jsdom",
    globals: true,
    css: true,
    setupFiles: [setup],
    // Counts commits with React's <Profiler>, which Preact does not have
    testNamePattern: /^(?!.*opens in one commit without a blocking nested update)/,
  },
});
