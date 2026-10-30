import { h, render } from "preact";
import type { Annotation } from "@agentation/core/types";
import { PageFeedbackToolbarCSS, type PageFeedbackToolbarCSSProps } from "@agentation/core/ui";
import type { ComponentDetector } from "@agentation/core/detection";

export type AgentationOptions = PageFeedbackToolbarCSSProps;

export interface AgentationInstance {
  /** Replaces the toolbar's options and re-renders */
  update(options: AgentationOptions): void;
  /** Unmounts the toolbar */
  destroy(): void;
}

function resolveOptions(options: AgentationOptions): PageFeedbackToolbarCSSProps {
  const detectors: readonly ComponentDetector[] = options.detectors ?? [];
  return {
    observeNavigation: true,
    ...options,
    detectors,
  };
}

/**
 * Renders the toolbar into `container` with Preact. The toolbar portals itself
 * into `document.body` (or `portalContainer`), so the container stays empty.
 * Detects only the components of the `detectors` passed, so an adapter
 * bundles just its own framework's detector.
 */
export function mountToolbar(container: Element | DocumentFragment, options: AgentationOptions = {}): AgentationInstance {
  let destroyed = false;
  const paint = (next: AgentationOptions) => {
    if (!destroyed) render(h(PageFeedbackToolbarCSS, resolveOptions(next)), container);
  };
  paint(options);
  return {
    update: paint,
    destroy() {
      if (destroyed) return;
      render(null, container);
      destroyed = true;
    },
  };
}

/**
 * Wraps an adapter's callbacks in functions that never change. The toolbar
 * keys effects on callback identity, while template handlers (Vue, Svelte)
 * are new on every render; these call whichever callback is current. Send to
 * Agent and Open in editor only appear when their callbacks are present, so
 * those two pass through as undefined when unset.
 */
export function createStableCallbacks() {
  let current: AgentationOptions = {};
  const stable = {
    onAnnotationAdd: (annotation: Annotation) => current.onAnnotationAdd?.(annotation),
    onAnnotationDelete: (annotation: Annotation) => current.onAnnotationDelete?.(annotation),
    onAnnotationUpdate: (annotation: Annotation) => current.onAnnotationUpdate?.(annotation),
    onAnnotationsClear: (annotations: Annotation[]) => current.onAnnotationsClear?.(annotations),
    onCopy: (output: string) => current.onCopy?.(output),
    onSessionCreated: (sessionId: string) => current.onSessionCreated?.(sessionId),
    onSubmit: (output: string, annotations: Annotation[]) => current.onSubmit?.(output, annotations),
    onOpenSource: (sourceFile: string) => current.onOpenSource?.(sourceFile),
  };
  return (options: AgentationOptions): AgentationOptions => {
    current = options;
    return {
      ...options,
      ...stable,
      onSubmit: options.onSubmit ? stable.onSubmit : undefined,
      onOpenSource: options.onOpenSource ? stable.onOpenSource : undefined,
    };
  };
}
