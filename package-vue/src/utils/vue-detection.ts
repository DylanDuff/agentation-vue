// =============================================================================
// Vue Component Name + Source Detection
// Vue counterpart of the React package's react-detection.ts and
// source-location.ts. Reads the dev-mode `__vueParentComponent` back-reference
// Vue sets on every element it renders, then walks `instance.parent`.
//
// Notes:
// - Vue only sets `__vueParentComponent` in development builds (or with
//   __VUE_PROD_DEVTOOLS__), the same constraint React has for _debugSource.
// - Source files come from `type.__file`, which @vitejs/plugin-vue and
//   vue-loader set in development. Vue does not record template line numbers,
//   so a line is only available when vite-plugin-vue-inspector (used by Nuxt
//   DevTools) has stamped elements with `data-v-inspector="file:line:col"`.
// =============================================================================

interface VueComponentType {
  name?: string;
  __name?: string;
  __file?: string;
  displayName?: string;
}

interface VueComponentInstance {
  uid: number;
  type: VueComponentType;
  parent: VueComponentInstance | null;
  subTree?: { el?: Node | null };
}

type VueElement = Element & {
  __vueParentComponent?: VueComponentInstance;
  __vue_app__?: unknown;
};

// =============================================================================
// Default Filter Configuration
// =============================================================================

/** Exact names to always skip (Vue, Vue Router and Nuxt internals) */
export const DEFAULT_SKIP_EXACT = new Set([
  "Anonymous",
  "BaseTransition",
  "Transition",
  "TransitionGroup",
  "KeepAlive",
  "Teleport",
  "Suspense",
  "AsyncComponentWrapper",
  "RouterView",
  "RouterLink",
  "NuxtRoot",
  "NuxtApp",
  "NuxtLayout",
  "NuxtLayoutProvider",
  "NuxtPage",
  "NuxtLink",
  "NuxtErrorBoundary",
  "NuxtLoadingIndicator",
  "NuxtRouteAnnouncer",
  "NuxtIsland",
  "NuxtClientFallback",
  "ClientOnly",
  "ServerPlaceholder",
  "RouteProvider",
  "Root",
  "VTU_ROOT", // @vue/test-utils mount wrapper
  "VTUROOT",
]);

/** Patterns for framework internals */
export const DEFAULT_SKIP_PATTERNS: RegExp[] = [
  /Provider$/,
  /Boundary$/,
  /^(Inner|Outer)/,
  /Router$/,
  /^Nuxt[A-Z]/,
  /^Lazy[A-Z]/, // Nuxt lazy component wrappers
  /^(Dev|Vue)(Overlay|Tools|Root)/,
  /Overlay$/,
  /Wrapper$/,
  /^Root$/,
];

/** Patterns that indicate likely user-defined components (smart mode fallback) */
const DEFAULT_USER_PATTERNS: RegExp[] = [
  /Page$/, /View$/, /Screen$/, /Section$/, /Card$/, /List$/, /Item$/, /Form$/,
  /Modal$/, /Dialog$/, /Button$/, /Nav$/, /Header$/, /Footer$/, /Layout$/,
  /Panel$/, /Tab$/, /Menu$/,
];

// =============================================================================
// Configuration Types
// =============================================================================

export type VueDetectionMode = "all" | "filtered" | "smart";

export interface VueDetectionConfig {
  /** How many component names to collect. @default 6 */
  maxComponents?: number;
  /** Maximum instance depth to traverse. @default 30 */
  maxDepth?: number;
  /** 'smart' requires DOM class correlation, 'filtered' skips internals, 'all' skips nothing. @default 'filtered' */
  mode?: VueDetectionMode;
  skipExact?: Set<string> | string[];
  skipPatterns?: RegExp[];
  userPatterns?: RegExp[];
  /** Return true to INCLUDE the component */
  filter?: (name: string, depth: number) => boolean;
}

interface ResolvedConfig {
  maxComponents: number;
  maxDepth: number;
  mode: VueDetectionMode;
  skipExact: Set<string>;
  skipPatterns: RegExp[];
  userPatterns: RegExp[];
  filter?: (name: string, depth: number) => boolean;
}

function resolveConfig(config?: VueDetectionConfig): ResolvedConfig {
  let skipExact = DEFAULT_SKIP_EXACT;
  if (config?.skipExact) {
    skipExact = new Set([...DEFAULT_SKIP_EXACT, ...config.skipExact]);
  }
  return {
    maxComponents: config?.maxComponents ?? 6,
    maxDepth: config?.maxDepth ?? 30,
    mode: config?.mode ?? "filtered",
    skipExact,
    skipPatterns: config?.skipPatterns
      ? [...DEFAULT_SKIP_PATTERNS, ...config.skipPatterns]
      : DEFAULT_SKIP_PATTERNS,
    userPatterns: config?.userPatterns ?? DEFAULT_USER_PATTERNS,
    filter: config?.filter,
  };
}

// =============================================================================
// Filter Logic (same heuristics as the React package)
// =============================================================================

/** SideNav -> side-nav */
function normalizeComponentName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function getAncestorClasses(element: Element, maxDepth = 10): Set<string> {
  const classes = new Set<string>();
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < maxDepth) {
    const className = current.getAttribute("class");
    if (className) {
      className.split(/\s+/).forEach((cls) => {
        if (cls.length > 1) {
          const normalized = cls.replace(/[_][a-zA-Z0-9]{5,}.*$/, "").toLowerCase();
          if (normalized.length > 1) classes.add(normalized);
        }
      });
    }
    current = current.parentElement;
    depth++;
  }
  return classes;
}

function componentCorrelatesWithDOM(componentName: string, domClasses: Set<string>): boolean {
  const normalized = normalizeComponentName(componentName);
  for (const cls of domClasses) {
    if (cls === normalized) return true;
    const componentWords = normalized.split("-").filter((w) => w.length > 2);
    const classWords = cls.split("-").filter((w) => w.length > 2);
    for (const cWord of componentWords) {
      for (const dWord of classWords) {
        if (cWord === dWord || cWord.includes(dWord) || dWord.includes(cWord)) return true;
      }
    }
  }
  return false;
}

function shouldIncludeComponent(
  name: string,
  depth: number,
  config: ResolvedConfig,
  domClasses?: Set<string>,
): boolean {
  if (config.filter) return config.filter(name, depth);
  if (config.mode === "all") return true;
  if (config.skipExact.has(name)) return false;
  if (config.skipPatterns.some((p) => p.test(name))) return false;
  if (config.mode === "filtered") return true;
  // smart
  if (domClasses && componentCorrelatesWithDOM(name, domClasses)) return true;
  return config.userPatterns.some((p) => p.test(name));
}

function isMinifiedName(name: string): boolean {
  if (name.length <= 2) return true;
  if (name.length <= 3 && name === name.toLowerCase()) return true;
  return false;
}

// =============================================================================
// Vue Instance Access
// =============================================================================

let vueDetectionCache: boolean | null = null;

/** Checks if a Vue 3 app is mounted on the page */
export function isVuePage(): boolean {
  if (vueDetectionCache !== null) return vueDetectionCache;
  if (typeof document === "undefined") return false;

  // createApp().mount() marks its container with data-v-app and __vue_app__
  const roots = document.querySelectorAll("[data-v-app], #app, #__nuxt");
  for (const el of roots) {
    if ((el as VueElement).__vue_app__ || el.hasAttribute("data-v-app")) {
      vueDetectionCache = true;
      return true;
    }
  }
  if (document.body) {
    for (const child of document.body.children) {
      if ((child as VueElement).__vue_app__ || (child as VueElement).__vueParentComponent) {
        vueDetectionCache = true;
        return true;
      }
    }
  }
  vueDetectionCache = false;
  return false;
}

export function clearVueDetectionCache(): void {
  vueDetectionCache = null;
}

/** Owning component instance of an element, looking up the DOM when the element itself was not rendered by Vue */
export function getVueInstance(element: Element, maxAncestors = 10): VueComponentInstance | null {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < maxAncestors) {
    const instance = (current as VueElement).__vueParentComponent;
    if (instance) return instance;
    current = current.parentElement;
    depth++;
  }
  return null;
}

function fileBaseName(file: string): string | null {
  const match = file.match(/([^/\\]+)\.(vue|tsx|jsx|ts|js)$/);
  return match ? match[1] : null;
}

export function getComponentName(instance: VueComponentInstance): string | null {
  const type = instance.type;
  if (!type) return null;
  const name = type.name || type.__name || type.displayName || (type.__file && fileBaseName(type.__file));
  if (!name) return null;
  // Show names in PascalCase like Vue DevTools does (my-button, transition)
  return name.replace(/(?:^|[-_])(\w)/g, (_, c: string) => c.toUpperCase());
}

// =============================================================================
// Component Name Detection
// =============================================================================

export interface VueComponentInfo {
  /** Full component path like "<App> <Layout> <Button>" */
  path: string | null;
  /** Component names from innermost to outermost */
  components: string[];
}

/** Walks up the component instance tree to collect component names */
export function getVueComponentName(element: HTMLElement, config?: VueDetectionConfig): VueComponentInfo {
  const resolved = resolveConfig(config);
  const empty: VueComponentInfo = { path: null, components: [] };

  let instance = getVueInstance(element);
  if (!instance) return empty;

  const domClasses = resolved.mode === "smart" ? getAncestorClasses(element) : undefined;
  const components: string[] = [];

  try {
    let depth = 0;
    while (instance && depth < resolved.maxDepth && components.length < resolved.maxComponents) {
      const name = getComponentName(instance);
      if (name && !isMinifiedName(name) && shouldIncludeComponent(name, depth, resolved, domClasses)) {
        components.push(name);
      }
      instance = instance.parent;
      depth++;
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

export interface SourceLocation {
  /** File path, relative to the project root when it can be determined */
  fileName: string;
  /** Line number (1-indexed), only known with vite-plugin-vue-inspector */
  lineNumber?: number;
  /** Column number, only known with vite-plugin-vue-inspector */
  columnNumber?: number;
  componentName?: string;
}

export type SourceLocationNotFoundReason =
  | "not-vue-app"
  | "no-instance"
  | "no-debug-source"
  | "unknown";

export interface SourceLocationResult {
  found: boolean;
  source?: SourceLocation;
  reason?: SourceLocationNotFoundReason;
  isVueApp: boolean;
}

/** Strips absolute prefixes so paths read like `src/components/Button.vue` */
export function cleanSourcePath(rawPath: string): string {
  let path = rawPath.replace(/\\/g, "/").replace(/^file:\/\//, "").replace(/\?.*$/, "");
  const markers = ["/src/", "/app/", "/components/", "/pages/", "/layouts/"];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index !== -1) return path.slice(index + 1);
  }
  path = path.replace(/^\/+/, "");
  return path;
}

function parseInspectorAttribute(element: Element): SourceLocation | null {
  const inspected = element.closest?.("[data-v-inspector]");
  const value = inspected?.getAttribute("data-v-inspector");
  if (!value) return null;
  const match = value.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match) return { fileName: cleanSourcePath(value) };
  return {
    fileName: cleanSourcePath(match[1]),
    lineNumber: Number(match[2]),
    columnNumber: match[3] !== undefined ? Number(match[3]) : undefined,
  };
}

/** Source location of the component that rendered an element */
export function getSourceLocation(element: HTMLElement): SourceLocationResult {
  const inspected = parseInspectorAttribute(element);
  const instance = getVueInstance(element, 1);

  if (inspected) {
    return {
      found: true,
      source: { ...inspected, componentName: instance ? getComponentName(instance) ?? undefined : undefined },
      isVueApp: true,
    };
  }

  if (!instance) {
    return { found: false, reason: isVuePage() ? "no-instance" : "not-vue-app", isVueApp: isVuePage() };
  }

  // Walk up past framework components that have no file (Transition, RouterView)
  let current: VueComponentInstance | null = instance;
  let depth = 0;
  while (current && depth < 30) {
    const file = current.type?.__file;
    if (file) {
      return {
        found: true,
        source: { fileName: cleanSourcePath(file), componentName: getComponentName(current) ?? undefined },
        isVueApp: true,
      };
    }
    current = current.parent;
    depth++;
  }

  return { found: false, reason: "no-debug-source", isVueApp: true };
}

/** Like getSourceLocation, but checks DOM ancestors when the element itself has no owner */
export function findNearestComponentSource(element: HTMLElement, maxAncestors = 10): SourceLocationResult {
  let current: HTMLElement | null = element;
  let depth = 0;
  while (current && depth < maxAncestors) {
    const result = getSourceLocation(current);
    if (result.found) return result;
    current = current.parentElement;
    depth++;
  }
  return getSourceLocation(element);
}

/** `src/components/Button.vue:42:8` (line and column when known) or a vscode:// URL */
export function formatSourceLocation(source: SourceLocation, format: "path" | "vscode" = "path"): string {
  const { fileName, lineNumber, columnNumber } = source;
  let location = fileName;
  if (lineNumber !== undefined) {
    location += `:${lineNumber}`;
    if (columnNumber !== undefined) location += `:${columnNumber}`;
  }
  if (format === "vscode") {
    return `vscode://file${fileName.startsWith("/") ? "" : "/"}${location}`;
  }
  return location;
}
