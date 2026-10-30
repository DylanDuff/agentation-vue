import { h, render } from "preact";
import type { Annotation } from "@agentation/core/types";
import { PageFeedbackToolbarCSS, type PageFeedbackToolbarCSSProps } from "@agentation/core/ui";
import type { ComponentDetector } from "@agentation/core/detection";
import { reactNamesDetector } from "@agentation/core/detectors/react";
import { svelteDetector } from "@agentation/core/detectors/svelte";
import { vueDetector } from "@agentation/core/detectors/vue";

export type AgentationOptions = PageFeedbackToolbarCSSProps;

/** Detectors used when an adapter does not choose its own: every framework the core knows */
export const DEFAULT_DETECTORS: readonly ComponentDetector[] = [vueDetector, svelteDetector, reactNamesDetector];

export interface AgentationInstance {
  /** Replaces the toolbar's options and re-renders */
  update(options: AgentationOptions): void;
  /** Unmounts the toolbar */
  destroy(): void;
}

function resolveOptions(options: AgentationOptions): PageFeedbackToolbarCSSProps {
  const detectors = options.detectors ?? DEFAULT_DETECTORS;
  return {
    observeNavigation: true,
    ...options,
    detectors,
    isDevMode: options.isDevMode ?? detectors.some((detector) => detector.isDevBuild?.() ?? false),
  };
}

/**
 * Renders the toolbar into `container` with Preact. The toolbar portals itself
 * into `document.body` (or `portalContainer`), so the container stays empty.
 */
export function mountAgentation(container: Element | DocumentFragment, options: AgentationOptions = {}): AgentationInstance {
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
