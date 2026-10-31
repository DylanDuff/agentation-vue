<picture>
  <source media="(prefers-color-scheme: dark)" srcset="package/logo-dark.svg">
  <img src="package/logo.svg" alt="Agentation" width="180">
</picture>

<br>

[![npm version](https://img.shields.io/npm/v/agentation)](https://www.npmjs.com/package/agentation)
[![downloads](https://img.shields.io/npm/dm/agentation)](https://www.npmjs.com/package/agentation)

**[Agentation](https://agentation.com)** is an agent-agnostic visual feedback tool. Click elements on your page, add notes, and copy structured output that helps AI coding agents find the exact code you're referring to.

## Install

```bash
npm install agentation -D
```

## Usage

```tsx
import { Agentation } from 'agentation';

function App() {
  return (
    <>
      <YourApp />
      <Agentation />
    </>
  );
}
```

The toolbar appears in the bottom-right corner. Click to activate, then click any element to annotate it.

## Connect to your agent

Copied feedback works with Claude Code, Codex, Gemini, Grok, or any AI tool.
For direct sync, register `npx -y agentation-mcp server` with your MCP client and
connect the toolbar to its HTTP endpoint:

```tsx
<Agentation endpoint="http://localhost:4747" />
```

Keep the agent running, add a test annotation, and ask it to read the feedback.
See the [setup guide](https://agentation.com/install#agent-integration).

## Features

- **Click to annotate** – Click any element with automatic selector identification
- **Text selection** – Select text to annotate specific content
- **Multi-select** – Hold Cmd/Ctrl to select elements individually, or drag to select multiple at once
- **Area selection** – Drag to annotate any region, even empty space
- **Animation pause** – Pause supported CSS animations, Web Animations, and videos to capture specific states
- **Structured output** – Copy markdown with selectors, positions, and context
- **Embedded pages** – Select elements in open shadow roots and same-origin iframes
- **Integration options** – Capture identifying attributes, choose metadata-only Copy formats, and open detected source locations through your editor integration
- **Hash routes** – Opt in to separate annotations and sessions for each hash route
- **Dark/light mode** – Toggle in settings, persists to localStorage
- **Zero dependencies** – No runtime libraries beyond the React peer dependencies

See the [package README](package/README.md) for props and integration examples.

## How it works

Agentation captures class names, selectors, and element positions so AI agents can `grep` for the exact code you're referring to. Instead of describing "the blue button in the sidebar," you give the agent `.sidebar > button.primary` and your feedback.

## Requirements

- React 18+
- Desktop browser (mobile not supported)

## Docs

Full documentation at [agentation.com](https://agentation.com)

Developer reference:

- [Toolbar to server sync](docs/server-sync.md): how stored annotations map to server IDs, what gets uploaded, and how agent resolutions reach the page

## License

© 2026 Benji Taylor

Licensed under PolyForm Shield 1.0.0
