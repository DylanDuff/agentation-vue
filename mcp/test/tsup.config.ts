import { defineConfig } from "tsup";
import { resolve } from "node:path";
export default defineConfig({
  entry: { integration: "test/entry.ts", "local-server": "test/local-server.ts", "http-entry": "test/http-entry.ts", "cli-review": "src/cli.ts" },
  outDir: ".test-dist",
  format: ["cjs"],
  clean: true,
  esbuildPlugins: [{ name: "disposable-sqlite", setup(build) {
    build.onResolve({ filter: /^\.\/store\.js$/ }, args =>
      args.importer.endsWith("/server/http.ts") ? { path: resolve("test/store-adapter.ts") } : undefined);
  } }],
  external: ["better-sqlite3", "@modelcontextprotocol/sdk", "@modelcontextprotocol/server", "zod"],
  define: { __VERSION__: JSON.stringify("test") },
});
