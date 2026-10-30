# Agentation

Monorepo containing:

1. **Core** (`package-core/`, `@agentation/core`) - Framework-agnostic types, utils, component detectors and SCSS, bundled into every adapter
2. **npm package** (`package/`) - React adapter. See `package/AGENTS.md`
3. **Vue package** (`package-vue/`) - Vue 3 adapter
4. **Website/docs** (`package/example/`) - See `package/example/AGENTS.md`
5. **MCP server** (`mcp/`, published as `agentation-mcp`)
6. **Agent skills** (`skills/`)

## What is Agentation?

A floating toolbar for annotating web pages and collecting structured feedback for AI coding agents.

## Development

```bash
pnpm install    # Install all workspace dependencies
pnpm dev        # Run both package watch + website dev server
pnpm build      # Build package only
```

## Important

The npm packages are public. Changes to `package/src/` or `package-core/src/` affect all users.
Website changes (`package/example/`) only affect agentation.com.

## PR/Issue Approach

- Package size is critical - avoid bloat
- UI changes need extra scrutiny
- Plugins/extensions → encourage separate repos
- External binary files → never accept

## Annotations

Whenever the user brings up annotations, fetch all the pending annotations before doing anything else. And infer whether I am referencing any annotations.
