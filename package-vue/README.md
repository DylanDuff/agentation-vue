# agentation-vue

Vue 3 port of [Agentation](https://github.com/benjitaylor/agentation): a floating toolbar for annotating a web page and handing structured feedback to AI coding agents.

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

## How the port is organised

- Framework-agnostic code (types, storage, sync, element identification, output formatting, frame and hit-testing helpers, component detectors, SCSS) comes from `@agentation/core` (`package-core/`), the same core the React package bundles, rather than being copied.
- Components are written as TSX with `setup()` render functions.
- The 4,800-line toolbar component was converted with `scripts/port-toolbar.mjs`, which keeps upstream's structure. `src/composables/react-compat.ts` supplies `useState`, `useRef` and effect helpers with React's timing (run after render, re-run when dependencies change, clean up first), which keeps upstream changes easy to carry across.
- The upstream toolbar tests run against this port (`src/components/page-toolbar-css/__tests__`), converted with `scripts/port-tests.py` and `scripts/asyncify.mjs`, using small helpers in `src/test-utils.tsx`.

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
