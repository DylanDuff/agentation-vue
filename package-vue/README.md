# agentation-vue

Vue 3 adapter for [Agentation](https://github.com/benjitaylor/agentation): a floating toolbar for annotating a web page and handing structured feedback to AI coding agents.

## Usage

```vue
<script setup lang="ts">
import { Agentation } from "agentation-vue";
</script>

<template>
  <RouterView />
  <Agentation @annotation-add="(a) => console.log(a)" />
</template>
```

Props and callbacks match the React package (`endpoint`, `sessionId`, `webhookUrl`, `copyFormat`, `onAnnotationAdd`, `onCopy`, `onSubmit`, and so on). Callbacks are regular props, so both `:on-copy="fn"` and `@copy="fn"` work. A `class` on `<Agentation>` reaches the toolbar host the same way React's `className` does.

Requires Vue 3.5 or newer.

## Component detection

In development builds the toolbar names the Vue components around each element (for example `<App> <ProductCard> h2 "Starter"`), using the component instances Vue attaches to DOM nodes. File paths come from `__file`, which Vite adds to SFCs in development. Line numbers need [vite-plugin-vue-inspector](https://github.com/webfansplz/vite-plugin-vue-inspector) (its `data-v-inspector` attributes). Production builds strip this metadata, so detection turns itself off there.

## How it is built

The toolbar itself is the shared UI from `@agentation/core` (`package-core/src/ui`), the same component the React package renders. Here it is rendered with Preact (through `preact/compat`, about 7 KB gzipped) inside the toolbar's own shadow root, so Vue and Preact never share a tree. `<Agentation>` is a thin Vue component (`src/components/agentation.ts`) that mounts it through `mountAgentation` from `agentation-element` and passes prop changes along. A fix to the toolbar lands in React, Vue, Svelte and the custom element at once.

The toolbar test suites live in `test/` and run against the shared UI through the Vue wrapper.

## Development

```bash
pnpm install
pnpm --filter agentation-vue dev        # playground at http://localhost:5173
pnpm --filter agentation-vue test
pnpm --filter agentation-vue typecheck
pnpm --filter agentation-vue build
```

## License

PolyForm Shield 1.0.0, same as upstream. See `LICENSE`.
