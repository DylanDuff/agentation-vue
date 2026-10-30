// Helpers shared by the Vue and Svelte detectors: the same component filtering
// heuristics as the React detector, and source path formatting.

export interface SourceLocation {
  /** File path, relative to the project root when it can be determined */
  fileName: string;
  /** Line number (1-indexed), when the framework records it */
  lineNumber?: number;
  /** Column number, when the framework records it */
  columnNumber?: number;
  componentName?: string;
}

/** SideNav -> side-nav */
export function normalizeComponentName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function getAncestorClasses(element: Element, maxDepth = 10): Set<string> {
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

export function componentCorrelatesWithDOM(componentName: string, domClasses: Set<string>): boolean {
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

export function isMinifiedName(name: string): boolean {
  if (name.length <= 2) return true;
  if (name.length <= 3 && name === name.toLowerCase()) return true;
  return false;
}

export type ComponentFilterMode = "all" | "filtered" | "smart";

export interface ComponentFilterConfig {
  mode: ComponentFilterMode;
  skipExact: Set<string>;
  skipPatterns: RegExp[];
  userPatterns: RegExp[];
  /** Return true to INCLUDE the component */
  filter?: (name: string, depth: number) => boolean;
}

/** 'all' keeps everything, 'filtered' drops framework internals, 'smart' also requires a DOM class or naming match */
export function shouldIncludeComponent(
  name: string,
  depth: number,
  config: ComponentFilterConfig,
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

/** Patterns that indicate likely user-defined components (smart mode fallback) */
export const DEFAULT_USER_PATTERNS: RegExp[] = [
  /Page$/, /View$/, /Screen$/, /Section$/, /Card$/, /List$/, /Item$/, /Form$/,
  /Modal$/, /Dialog$/, /Button$/, /Nav$/, /Header$/, /Footer$/, /Layout$/,
  /Panel$/, /Tab$/, /Menu$/,
];

/** Strips absolute prefixes so paths read like `src/components/Button.vue` */
export function cleanSourcePath(rawPath: string): string {
  let path = rawPath.replace(/\\/g, "/").replace(/^file:\/\//, "").replace(/\?.*$/, "");
  // Already relative (e.g. Angular's "src/app/card.component.html"): keep it whole
  if (!path.startsWith("/") && !/^[a-zA-Z]:\//.test(path)) path = `/${path}`;
  const markers = ["/src/", "/app/", "/components/", "/pages/", "/layouts/"];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index !== -1) return path.slice(index + 1);
  }
  path = path.replace(/^\/+/, "");
  return path;
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
