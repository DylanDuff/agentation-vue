// Renders the core UI (written against the React API) with Preact. Used by every
// adapter that is not React itself: the custom element, Vue and Svelte.
export const preactAliases = [
  { find: /^react$/, replacement: "preact/compat" },
  { find: /^react-dom$/, replacement: "preact/compat" },
  { find: /^react-dom\/client$/, replacement: "preact/compat/client" },
  { find: /^react-dom\/test-utils$/, replacement: "preact/test-utils" },
  { find: /^react\/jsx-runtime$/, replacement: "preact/jsx-runtime" },
  { find: /^react\/jsx-dev-runtime$/, replacement: "preact/jsx-dev-runtime" },
];
