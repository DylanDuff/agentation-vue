// The Svelte component ships as source, compiled by the app's own Svelte (4 or 5).
// Vite bundles runtime.ts; these files sit next to it in dist.
import { copyFileSync } from "node:fs";

for (const file of ["Agentation.svelte", "Agentation.svelte.d.ts", "index.js", "index.d.ts"]) {
  copyFileSync(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
