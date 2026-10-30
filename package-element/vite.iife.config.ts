import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { scssModulesPlugin } from "../package-core/build/scss-modules-plugin";
import { preactAliases } from "../package-core/build/preact-aliases";

// The core UI marks its modules "use client" for React Server Components; meaningless here
const ROLLUP_OPTIONS = {
  onwarn(warning: { code?: string }, warn: (warning: unknown) => void) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE" || warning.code === "SOURCEMAP_ERROR") return;
    warn(warning);
  },
};

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Script-tag build: <script src=".../agentation.iife.js"></script> registers <agentation-feedback>
export default defineConfig({
  plugins: [scssModulesPlugin()],
  resolve: { alias: preactAliases },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: {
    emptyOutDir: false,
    lib: { entry: "src/auto.ts", formats: ["iife"], name: "Agentation", fileName: () => "agentation.iife.js" },
    minify: true,
    sourcemap: true,
    rollupOptions: {
      ...ROLLUP_OPTIONS,
    },
  },
});
