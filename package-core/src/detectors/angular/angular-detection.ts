// =============================================================================
// Angular Component Detection
// =============================================================================
//
// Angular development builds publish debugging helpers on `window.ng`
// (`getComponent`, `getOwningComponent`), the same ones Angular DevTools uses.
// The component path comes from walking the element's ancestors and asking
// which of them host a component. Names come from the class, or from the
// debug info the Angular CLI attaches to each component (`ɵsetClassDebugInfo`).
//
// Source locations:
// - With template source locations on, every template element carries
//   `data-ng-source-location="src/app/card.component.html@o:120,l:4,c:2"`
//   (0-based line and column): the exact element line.
// - Otherwise, the component's class file and line from its debug info.
//
// Production builds publish no `window.ng` and minify class names, so
// detection turns itself off there.
//
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

interface AngularDebugInfo {
  className?: string;
  filePath?: string;
  lineNumber?: number;
}

type AngularComponentClass = { name?: string; ɵcmp?: { debugInfo?: AngularDebugInfo | null } };

interface AngularGlobalUtils {
  getComponent?(element: Element): object | null;
  getOwningComponent?(element: Element): object | null;
}

// =============================================================================
// Default Filter Configuration
// =============================================================================

/** Exact names to always skip */
export const DEFAULT_SKIP_EXACT = new Set(["Object", "Component"]);

/** Patterns for framework internals and generated classes */
export const DEFAULT_SKIP_PATTERNS: RegExp[] = [/^_/, /^ɵ/, /Wrapper(Component)?$/];

// =============================================================================
// Configuration Types
// =============================================================================

export type AngularDetectionMode = "all" | "filtered" | "smart";

export interface AngularDetectionConfig {
  /** How many component names to collect. @default 6 */
  maxComponents?: number;
  /** Maximum DOM ancestors to walk. @default 60 */
  maxDepth?: number;
  /** 'smart' requires DOM class correlation, 'filtered' skips internals, 'all' skips nothing. @default 'filtered' */
  mode?: AngularDetectionMode;
  skipExact?: Set<string> | string[];
  skipPatterns?: RegExp[];
  userPatterns?: RegExp[];
  /** Return true to INCLUDE the component */
  filter?: (name: string, depth: number) => boolean;
}

function resolveConfig(config?: AngularDetectionConfig) {
  return {
    maxComponents: config?.maxComponents ?? 6,
    maxDepth: config?.maxDepth ?? 60,
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
// Angular Debug API Access
// =============================================================================

function globalUtils(): AngularGlobalUtils | null {
  if (typeof window === "undefined") return null;
  const ng = (window as unknown as { ng?: AngularGlobalUtils }).ng;
  return ng && typeof ng.getComponent === "function" ? ng : null;
}

/** Checks if Angular is rendering the page (every app root carries `ng-version`, in any build) */
export function isAngularPage(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[ng-version]");
}

/** Whether Angular's development helpers are available (development builds only) */
export function isAngularDevBuild(): boolean {
  return globalUtils() !== null;
}

function componentClass(component: object): AngularComponentClass {
  return (component as { constructor: AngularComponentClass }).constructor;
}

function debugInfo(component: object): AngularDebugInfo | null {
  return componentClass(component).ɵcmp?.debugInfo ?? null;
}

/** Class name of a component instance, preferring the CLI's debug info */
export function angularComponentName(component: object): string | null {
  return debugInfo(component)?.className || componentClass(component).name || null;
}

function safeCall<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    // ng.* throws for nodes Angular does not manage
    return null;
  }
}

// =============================================================================

export interface AngularComponentInfo {
  /** Full component path like "<AppComponent> <ProductCardComponent>" */
  path: string | null;
  /** Component names from innermost to outermost */
  components: string[];
}

/** Collects the components hosting `element` and its ancestors, innermost first */
export function getAngularComponentName(element: HTMLElement, config?: AngularDetectionConfig): AngularComponentInfo {
  const resolved = resolveConfig(config);
  const empty: AngularComponentInfo = { path: null, components: [] };
  const ng = globalUtils();
  if (!ng?.getComponent) return empty;

  const domClasses = resolved.mode === "smart" ? getAncestorClasses(element) : undefined;
  const components: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  let hostDepth = 0;

  while (current && depth < resolved.maxDepth && components.length < resolved.maxComponents) {
    const host = current;
    const component = safeCall(() => ng.getComponent!(host));
    if (component) {
      const name = angularComponentName(component);
      if (name && !isMinifiedName(name) && shouldIncludeComponent(name, hostDepth, resolved, domClasses)) {
        components.push(name);
      }
      hostDepth++;
    }
    current = current.parentElement;
    depth++;
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

export type SourceLocationNotFoundReason = "not-angular-app" | "production-build" | "no-debug-source";

export interface SourceLocationResult {
  found: boolean;
  source?: SourceLocation;
  reason?: SourceLocationNotFoundReason;
  isAngularApp: boolean;
}

const SOURCE_LOCATION_ATTRIBUTE = "data-ng-source-location";

/** "src/app/card.component.html@o:120,l:4,c:2" (0-based line and column) */
export function parseSourceLocationAttribute(value: string): SourceLocation | null {
  const match = /^(.*)@o:\d+,l:(\d+),c:(\d+)$/.exec(value);
  if (!match) return null;
  return {
    fileName: cleanSourcePath(match[1]),
    lineNumber: Number(match[2]) + 1,
    columnNumber: Number(match[3]) + 1,
  };
}

function notFound(): SourceLocationResult {
  const isAngularApp = isAngularPage();
  if (!isAngularApp) return { found: false, reason: "not-angular-app", isAngularApp };
  return { found: false, reason: isAngularDevBuild() ? "no-debug-source" : "production-build", isAngularApp };
}

/** Source location of the template element that rendered `element` */
export function getSourceLocation(element: HTMLElement): SourceLocationResult {
  const attribute = element.getAttribute(SOURCE_LOCATION_ATTRIBUTE);
  const source = attribute ? parseSourceLocationAttribute(attribute) : null;
  if (!source) return notFound();
  const owner = safeCall(() => globalUtils()?.getOwningComponent?.(element) ?? null);
  return {
    found: true,
    source: { ...source, componentName: owner ? angularComponentName(owner) ?? undefined : undefined },
    isAngularApp: true,
  };
}

/**
 * Like getSourceLocation, but checks DOM ancestors for a template location,
 * then falls back to the owning component's class file.
 */
export function findNearestComponentSource(element: HTMLElement, maxAncestors = 10): SourceLocationResult {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < maxAncestors; depth++) {
    if (current.hasAttribute(SOURCE_LOCATION_ATTRIBUTE)) {
      const result = getSourceLocation(current);
      if (result.found) return result;
    }
    current = current.parentElement;
  }

  const ng = globalUtils();
  const owner = ng && safeCall(() => ng.getOwningComponent?.(element) ?? ng.getComponent?.(element) ?? null);
  const info = owner ? debugInfo(owner) : null;
  if (owner && info?.filePath) {
    return {
      found: true,
      source: {
        fileName: cleanSourcePath(info.filePath),
        lineNumber: info.lineNumber,
        componentName: angularComponentName(owner) ?? undefined,
      },
      isAngularApp: true,
    };
  }
  return notFound();
}
