import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { scssModulesPlugin } from "./scss-modules-plugin";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [scssModulesPlugin(), vue(), dts({ rollupTypes: true, tsconfigPath: "./tsconfig.json" })],
  resolve: {
    alias: {
      // Framework-agnostic code (utils, types, SCSS) is shared with the React package.
      "@core": fileURLToPath(new URL("../package/src", import.meta.url)),
    },
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
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
} as any);
