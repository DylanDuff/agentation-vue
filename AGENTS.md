# Agentation

Monorepo containing:

1. **Core** (`package-core/`, `@agentation/core`) - Framework-agnostic types, utils, component detectors, SCSS and the toolbar UI (`src/ui`, written against the React API), bundled into every adapter
2. **npm package** (`package/`) - React adapter, renders the core UI with the app's React. See `package/AGENTS.md`
3. **Custom element** (`package-element/`, `agentation-element`) - `<agentation-feedback>` and `mountAgentation`, rendering the core UI with Preact. Works on any page, and the Vue and Svelte adapters build on it
4. **Vue package** (`package-vue/`) - Vue 3 adapter, a thin wrapper over `mountAgentation`
5. **Svelte package** (`package-svelte/`) - Svelte 4 and 5 adapter, a thin wrapper over `mountAgentation`
6. **Website/docs** (`package/example/`) - See `package/example/AGENTS.md`
7. **MCP server** (`mcp/`, published as `agentation-mcp`)
8. **Agent skills** (`skills/`)

## What is Agentation?

A floating toolbar for annotating web pages and collecting structured feedback for AI coding agents.

## Development

```bash
pnpm install    # Install all workspace dependencies
pnpm dev        # Run both package watch + website dev server
pnpm build      # Build package only
```

## Important

The npm packages are public. Changes to `package/src/` or `package-core/src/` affect all users. Toolbar UI changes in `package-core/src/ui` reach every adapter: they run under React and under Preact (`preact/compat`), so test both (`pnpm --filter agentation-element test` runs the core toolbar suites under Preact).
Website changes (`package/example/`) only affect agentation.com.

## PR/Issue Approach

- Package size is critical - avoid bloat
- UI changes need extra scrutiny
- Plugins/extensions → encourage separate repos
- External binary files → never accept

## Annotations

Whenever the user brings up annotations, fetch all the pending annotations before doing anything else. And infer whether I am referencing any annotations.
