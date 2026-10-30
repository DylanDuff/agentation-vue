# agentation-svelte

Svelte adapter for [Agentation](https://github.com/benjitaylor/agentation): a floating toolbar for annotating a web page and handing structured feedback to AI coding agents. Works with Svelte 4 and 5, including SvelteKit.

## Usage

```svelte
<script>
  import { dev } from "$app/environment";
  import { Agentation } from "agentation-svelte";
</script>

<slot />
{#if dev}
  <Agentation onAnnotationAdd={(annotation) => console.log(annotation)} />
{/if}
```

Props and callbacks match the React package (`endpoint`, `sessionId`, `webhookUrl`, `copyFormat`, `onAnnotationAdd`, `onCopy`, `onSubmit`, and so on). A `class` reaches the toolbar host the same way React's `className` does. The toolbar mounts in the browser only, so it is safe in server-rendered layouts.

## Component detection

In development builds the toolbar names the Svelte components around each element (for example `<App> <ProductCard> h2 "Starter"`) and records the source file and line, using the metadata Svelte attaches to DOM nodes in dev mode. SvelteKit route files are named after their folder (`src/routes/blog/[slug]/+page.svelte` becomes `BlogSlugPage`). Production builds strip this metadata, so detection turns itself off there.

## How it is built

The toolbar is the shared UI from `@agentation/core`, the same component the React package renders, rendered with Preact (through `preact/compat`) inside the toolbar's own shadow root. `Agentation.svelte` ships as source and is compiled by your app's Svelte; it only passes props to `dist/runtime.js`, which bundles the toolbar.

## Development

```bash
pnpm install
pnpm --filter agentation-svelte dev     # playground at http://localhost:5173
pnpm --filter agentation-svelte test
pnpm --filter agentation-svelte typecheck
pnpm --filter agentation-svelte build
```

## License

PolyForm Shield 1.0.0, same as upstream.
