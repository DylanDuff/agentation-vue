# agentation-element

[Agentation](https://github.com/benjitaylor/agentation) for any page: a floating toolbar for annotating a web page and handing structured feedback to AI coding agents, packaged as the `<agentation-feedback>` custom element. Use it on sites with no framework, server-rendered pages, or a framework without its own adapter.

## Script tag

```html
<script src="https://unpkg.com/agentation-element/dist/agentation.iife.js"></script>
<agentation-feedback app-name="Docs" endpoint="http://localhost:4747"></agentation-feedback>
```

The script registers the element as soon as it loads.

## Bundler

```ts
import { defineAgentationElement } from "agentation-element";

defineAgentationElement(); // registers <agentation-feedback>, safe to call more than once

const toolbar = document.createElement("agentation-feedback");
toolbar.options = { onAnnotationAdd: (annotation) => console.log(annotation) };
document.body.append(toolbar);
```

## Options

Simple options are attributes: `endpoint`, `session-id`, `webhook-url`, `app-name`, `copy-format`, `class-name`, `use-hash-location`, `copy-to-clipboard`, `enable-keyboard-shortcuts` and `dev-mode`. A boolean attribute is on when present, unless its value is `"false"`.

Everything else (callbacks, `demoAnnotations`, `detectors`) goes on the `options` property, which takes the same props as the React component. Properties win over attributes.

Every callback is also dispatched as a bubbling DOM event: `agentation:annotation-add`, `agentation:annotation-delete`, `agentation:annotation-update`, `agentation:annotations-clear`, `agentation:copy`, `agentation:session-created`, `agentation:open-source` and `agentation:submit`. The Send to Agent button appears only with an `onSubmit` option or the `send` attribute.

## Without the element

`mountAgentation(container, options)` renders the toolbar from any element and returns `{ update, destroy }`. The Vue and Svelte adapters are built on it.

## Component detection

The toolbar names the components around each element for Vue, Svelte and React pages in development builds. Pass `detectors` to choose your own.

## How it is built

The toolbar is the shared UI from `@agentation/core`, the same component the React package renders, rendered here with Preact (through `preact/compat`) inside the toolbar's own shadow root. `pnpm test` also runs the core toolbar suites under Preact (`vitest.preact.config.ts`), so the shared UI is checked under both renderers.

## License

PolyForm Shield 1.0.0, same as upstream.
