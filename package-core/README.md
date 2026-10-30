# @agentation/core

Framework-agnostic code shared by every Agentation adapter (`agentation` for
React, `agentation-vue` for Vue). It is bundled into each adapter at build
time and is not published on its own.

- `types.ts`: the `Annotation` model shared with the MCP server
- `utils/`: element identification, hit testing, iframes and shadow DOM,
  storage, server sync, clipboard, copy formats, animation freezing
- `design-mode/`: layout and rearrange logic and its markdown output
- `output/`: markdown output for annotations
- `detection.ts`: the `ComponentDetector` interface adapters plug into
- `detectors/`: React (fiber tree), Vue (instance tree) and Svelte
  (`__svelte_meta`) component detectors. None of them import their framework,
  so an adapter only bundles the detector it uses.
- `styles/`: SCSS for every toolbar component

Import by path, for example `@agentation/core/utils/storage` or
`@agentation/core/detectors/svelte`.
