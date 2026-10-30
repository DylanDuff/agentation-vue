import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scssModulesPlugin } from "../package-core/build/scss-modules-plugin";
import { preactAliases } from "../package-core/build/preact-aliases";
import { preactJsxPlugin } from "../package-core/build/preact-jsx-plugin";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [
    scssModulesPlugin(),
    vue(),
    // Vue JSX is for this package's tests; the core UI's TSX is Preact
    preactJsxPlugin(),
    vueJsx({ exclude: [/package-core/] }),
  ],
  resolve: {
    alias: [
      ...preactAliases,
      // Bundle the element from source, like @agentation/core
      { find: /^agentation-element\/mount$/, replacement: fileURLToPath(new URL("../package-element/src/mount.ts", import.meta.url)) },
    ],
  },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    sourcemap: true,
    rollupOptions: {
      external: ["vue"],
      // The core UI marks its modules "use client" for React Server Components; meaningless here
      onwarn(warning: { code?: string }, warn: (warning: unknown) => void) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" || warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
} as any);
