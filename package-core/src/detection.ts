// =============================================================================
// Component Detection
// =============================================================================
//
// Element identification (DOM path, readable name) is framework-agnostic.
// Component paths and source files are not: each framework exposes them through
// its own dev-mode internals. A detector adapts one framework to this shape so
// the toolbar can combine the two without knowing which framework is running.
//
// =============================================================================

import { identifyElement } from "./utils/element-identification";

/**
 * How much of the component path to collect. "off" skips detection; the other
 * modes are passed to the detector (see OUTPUT_TO_COMPONENT_MODE).
 */
export type ComponentPathMode = "smart" | "filtered" | "all" | "off";

export interface ComponentDetector {
  /** Framework name, used as the label in output (e.g. "React", "Vue") */
  name: string;
  /** Whether this framework is rendering the page */
  isActive(): boolean;
  /** Component path like "<App> <Layout> <Button>", or null when none is found */
  getComponentPath(element: HTMLElement, mode: Exclude<ComponentPathMode, "off">): string | null;
  /** Source file of the component that rendered the element, e.g. "src/Button.vue:12:4" */
  getSourceFile?(element: HTMLElement): string | undefined;
  /**
   * Whether the page runs a development build, where component names and
   * sources are available. Used when the adapter cannot tell on its own.
   */
  isDevBuild?(): boolean;
}

/** Elements to sample when looking for a framework's dev-mode metadata */
export function sampleElements(limit = 200): Element[] {
  if (typeof document === "undefined" || !document.body) return [];
  return Array.from(document.body.querySelectorAll("*")).slice(0, limit);
}

export type ComponentIdentification = {
  /** Combined name for display (component path + element) */
  name: string;
  /** Raw element name without component path */
  elementName: string;
  /** DOM path */
  path: string;
  /** Component path (e.g., '<SideNav> <LinkComponent>') */
  reactComponents: string | null;
};

/**
 * Composes framework-agnostic element identification with a detector's
 * component path. Accepts several detectors for pages that mix frameworks;
 * the first one that finds a path wins.
 */
export function identifyElementWithComponents(
  element: HTMLElement,
  detectors: ComponentDetector | readonly ComponentDetector[],
  mode: ComponentPathMode = "filtered",
  attributeNames?: readonly string[],
): ComponentIdentification {
  const { name: elementName, path } = identifyElement(element, attributeNames);

  if (mode === "off") {
    return { name: elementName, elementName, path, reactComponents: null };
  }

  let componentPath: string | null = null;
  for (const detector of toList(detectors)) {
    componentPath = detector.getComponentPath(element, mode);
    if (componentPath) break;
  }

  return {
    name: componentPath ? `${componentPath} ${elementName}` : elementName,
    elementName,
    path,
    reactComponents: componentPath,
  };
}

/** Source file from the first detector that knows it */
export function detectComponentSourceFile(
  element: Element,
  detectors: ComponentDetector | readonly ComponentDetector[],
): string | undefined {
  for (const detector of toList(detectors)) {
    const file = detector.getSourceFile?.(element as HTMLElement);
    if (file) return file;
  }
  return undefined;
}

function toList(detectors: ComponentDetector | readonly ComponentDetector[]): readonly ComponentDetector[] {
  return Array.isArray(detectors) ? detectors : [detectors as ComponentDetector];
}

/** Label for component paths in output and settings: the active framework, else the first adapter's */
export function componentLabel(detectors: readonly ComponentDetector[]): string {
  const active = detectors.find((detector) => detector.isActive());
  return (active ?? detectors[0])?.name ?? "Framework";
}
