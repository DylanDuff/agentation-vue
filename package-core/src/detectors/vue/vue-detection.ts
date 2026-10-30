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
