// =============================================================================
// Svelte Component Name + Source Detection
// Svelte counterpart of the React and Vue detectors. Reads the dev-mode
// `__svelte_meta` object Svelte sets on every element it renders.
//
// Notes:
// - Svelte only sets `__svelte_meta` in development builds (`dev: true`, the
//   default for `vite dev` with @sveltejs/vite-plugin-svelte).
// - Svelte 5: `{ loc: { file, line, column }, parent }`. `parent` is the render
//   stack: `component` entries (with `componentTag`) plus `if`, `each`,
//   `render` (snippets) and similar blocks. Each entry's `file` is the file it
//   appears in, so a component's own file is the file of the entry inside it.
//   Lines are 1-based.
// - Svelte 4: `{ loc: { file, line, column, char } }` with no `parent`, so the
//   component path comes from the files of DOM ancestors instead, and
//   components that render no element of their own are not seen. Lines are
//   0-based.
// - Columns are 0-based in both and reported 1-based, like editors expect.
// =============================================================================

import {
  cleanSourcePath,
  DEFAULT_USER_PATTERNS,
  formatSourceLocation,
  getAncestorClasses,
  isMinifiedName,
  shouldIncludeComponent,
  type SourceLocation,
} from "../shared";

export { cleanSourcePath, formatSourceLocation, type SourceLocation };

interface SvelteLocation {
  file?: string;
  line?: number;
  column?: number;
  /** Svelte 4 only */
  char?: number;
}

interface SvelteParentEntry {
  type?: string;
  file?: string;
  line?: number;
  column?: number;
  componentTag?: string;
  parent?: SvelteParentEntry | null;
}

interface SvelteMeta {
  loc?: SvelteLocation;
  parent?: SvelteParentEntry | null;
}

type SvelteElement = Element & { __svelte_meta?: SvelteMeta };

// =============================================================================
// Default Filter Configuration
// =============================================================================

/** Exact names to always skip (Svelte and SvelteKit internals) */
export const DEFAULT_SKIP_EXACT = new Set([
  "Root", // .svelte-kit/generated/root.svelte
  "Anonymous",
  "SvelteComponent",
]);

/** Patterns for framework internals */
export const DEFAULT_SKIP_PATTERNS: RegExp[] = [
  /^Pyramid_\d+$/, // SvelteKit's generated layout and page slots
  /^constructors\[/,
  /^svelte:/,
  /Provider$/,
  /Boundary$/,
  /Wrapper$/,
];

// =============================================================================
// Configuration Types
// =============================================================================

export type SvelteDetectionMode = "all" | "filtered" | "smart";

export interface SvelteDetectionConfig {
  /** How many component names to collect. @default 6 */
  maxComponents?: number;
  /** Maximum render stack depth to traverse. @default 30 */
  maxDepth?: number;
  /** 'smart' requires DOM class correlation, 'filtered' skips internals, 'all' skips nothing. @default 'filtered' */
  mode?: SvelteDetectionMode;
  skipExact?: Set<string> | string[];
  skipPatterns?: RegExp[];
  userPatterns?: RegExp[];
  /** Return true to INCLUDE the component */
  filter?: (name: string, depth: number) => boolean;
}

function resolveConfig(config?: SvelteDetectionConfig) {
  return {
    maxComponents: config?.maxComponents ?? 6,
    maxDepth: config?.maxDepth ?? 30,
    mode: config?.mode ?? "filtered",
    skipExact: config?.skipExact ? new Set([...DEFAULT_SKIP_EXACT, ...config.skipExact]) : DEFAULT_SKIP_EXACT,
    skipPatterns: config?.skipPatterns
      ? [...DEFAULT_SKIP_PATTERNS, ...config.skipPatterns]
      : DEFAULT_SKIP_PATTERNS,
    userPatterns: config?.userPatterns ?? DEFAULT_USER_PATTERNS,
    filter: config?.filter,
  };
}

// =============================================================================
// Svelte Metadata Access
// =============================================================================

/** Checks if Svelte has run on the page (Svelte 4+ records its version on window) */
export function isSveltePage(): boolean {
  if (typeof window === "undefined") return false;
  const disclosed = (window as unknown as { __svelte?: { v?: Set<string> } }).__svelte;
  return !!disclosed?.v && disclosed.v.size > 0;
}

/** Nearest element (self or ancestor) carrying Svelte dev metadata */
function findMetaElement(element: Element, maxAncestors = 10): SvelteElement | null {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < maxAncestors) {
    if ((current as SvelteElement).__svelte_meta?.loc) return current as SvelteElement;
    current = current.parentElement;
    depth++;
  }
  return null;
}

function toPascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Component name from its file: `Card.svelte` -> Card. SvelteKit route files
 * are named after their folder: `routes/blog/[slug]/+page.svelte` -> BlogSlugPage.
 */
export function componentNameFromFile(file: string): string | null {
  const parts = file.replace(/\\/g, "/").replace(/\?.*$/, "").split("/");
  const base = parts.pop()?.replace(/\.svelte$/, "");
  if (!base) return null;

  const route = base.match(/^\+(page|layout|error)(@.*)?$/);
  if (route) {
    const suffix = toPascalCase(route[1]);
    const routesIndex = parts.lastIndexOf("routes");
    const segments = (routesIndex === -1 ? parts.slice(-1) : parts.slice(routesIndex + 1))
      // Route groups like (app) do not appear in the URL
      .filter((segment) => !/^\(.*\)$/.test(segment));
    return toPascalCase(segments.join("-")) + suffix;
  }

  return toPascalCase(base);
}

/**
 * Component names from innermost to outermost. Svelte 5's render stack gives
 * every component, including ones without their own elements; Svelte 4 falls
 * back to the distinct files of the element's ancestors.
 */
function collectComponentNames(element: SvelteElement, maxDepth: number): string[] {
  const meta = element.__svelte_meta!;
  const names: string[] = [];

  if (meta.parent) {
    // The file just inside a component entry is that component's own file
    let innerFile = meta.loc?.file;
    let entry: SvelteParentEntry | null | undefined = meta.parent;
    let depth = 0;
    while (entry && depth < maxDepth) {
      if (entry.type === "component") {
        const name = (innerFile && componentNameFromFile(innerFile)) || entry.componentTag;
        if (name) names.push(name);
      }
      if (entry.file) innerFile = entry.file;
      entry = entry.parent;
      depth++;
    }
    // The outermost file belongs to the mounted root component
    const root = innerFile && componentNameFromFile(innerFile);
    if (root) names.push(root);
    return names;
  }

  let current: Element | null = element;
  let lastFile: string | undefined;
  let depth = 0;
  while (current && depth < maxDepth) {
    const file = (current as SvelteElement).__svelte_meta?.loc?.file;
    if (file && file !== lastFile) {
      const name = componentNameFromFile(file);
      if (name) names.push(name);
      lastFile = file;
    }
    current = current.parentElement;
    depth++;
  }
  return names;
}

// =============================================================================
// Component Name Detection
// =============================================================================

export interface SvelteComponentInfo {
  /** Full component path like "<App> <Layout> <Button>" */
  path: string | null;
  /** Component names from innermost to outermost */
  components: string[];
}

/** Collects the component path of the element that renders `element` */
export function getSvelteComponentName(element: HTMLElement, config?: SvelteDetectionConfig): SvelteComponentInfo {
  const resolved = resolveConfig(config);
  const empty: SvelteComponentInfo = { path: null, components: [] };

  const metaElement = findMetaElement(element);
  if (!metaElement) return empty;

  const domClasses = resolved.mode === "smart" ? getAncestorClasses(element) : undefined;
  const components: string[] = [];

  try {
    const names = collectComponentNames(metaElement, resolved.maxDepth);
    for (let depth = 0; depth < names.length && components.length < resolved.maxComponents; depth++) {
      const name = names[depth];
      if (!isMinifiedName(name) && shouldIncludeComponent(name, depth, resolved, domClasses)) {
        components.push(name);
      }
    }
  } catch {
    return empty;
  }

  if (components.length === 0) return empty;
  return {
    path: components.slice().reverse().map((c) => `<${c}>`).join(" "),
    components,
  };
}

// =============================================================================
// Source Location Detection
// =============================================================================

export type SourceLocationNotFoundReason = "not-svelte-app" | "no-debug-source";

export interface SourceLocationResult {
  found: boolean;
  source?: SourceLocation;
  reason?: SourceLocationNotFoundReason;
  isSvelteApp: boolean;
}

/** Source location of the markup that rendered an element (exact element line) */
export function getSourceLocation(element: HTMLElement): SourceLocationResult {
  const metaElement = findMetaElement(element, 1);
  const loc = metaElement?.__svelte_meta?.loc;
  if (!loc?.file) {
    const isSvelteApp = isSveltePage();
    return { found: false, reason: isSvelteApp ? "no-debug-source" : "not-svelte-app", isSvelteApp };
  }

  // Svelte 4 locations carry `char` and count lines from 0
  const zeroBasedLines = loc.char !== undefined;
  return {
    found: true,
    source: {
      fileName: cleanSourcePath(loc.file),
      lineNumber: loc.line !== undefined ? loc.line + (zeroBasedLines ? 1 : 0) : undefined,
      columnNumber: loc.column !== undefined ? loc.column + 1 : undefined,
      componentName: componentNameFromFile(loc.file) ?? undefined,
    },
    isSvelteApp: true,
  };
}

/** Like getSourceLocation, but checks DOM ancestors when the element itself has no metadata */
export function findNearestComponentSource(element: HTMLElement, maxAncestors = 10): SourceLocationResult {
  const metaElement = findMetaElement(element, maxAncestors);
  return getSourceLocation((metaElement as HTMLElement | null) ?? element);
}
