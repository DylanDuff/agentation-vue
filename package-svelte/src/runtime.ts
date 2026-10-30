// Everything Agentation.svelte needs, bundled: the shared toolbar (rendered
// with Preact inside the page's shadow DOM), the Svelte component detector
// and the shared utilities. The component itself only passes props through.
import { createStableCallbacks, mountAgentation, type AgentationOptions } from "agentation-element/mount";
import type { ComponentDetector } from "@agentation/core/detection";
import { svelteDetector } from "@agentation/core/detectors/svelte";

const SVELTE_DETECTORS: readonly ComponentDetector[] = [svelteDetector];

export type AgentationProps = AgentationOptions & {
  /** Alias for className, so `class="..."` works like on any element */
  class?: string;
};

/** Mounts the toolbar from `anchor`, an element the Svelte component rendered */
export function createAgentation(anchor: HTMLElement, props: AgentationProps) {
  // Svelte records element locations only in development builds
  const isDevMode = "__svelte_meta" in anchor;
  const stabilize = createStableCallbacks();
  const resolve = ({ class: className, ...options }: AgentationProps): AgentationOptions =>
    stabilize({
      ...options,
      className: [options.className, className].filter(Boolean).join(" ") || undefined,
      detectors: options.detectors ?? SVELTE_DETECTORS,
      isDevMode: options.isDevMode ?? isDevMode,
    });
  const instance = mountAgentation(anchor, resolve(props));
  return {
    update: (next: AgentationProps) => instance.update(resolve(next)),
    destroy: () => instance.destroy(),
  };
}

export { svelteDetector };
export type { ComponentDetector };
export type { Annotation } from "@agentation/core/types";
export type { DemoAnnotation } from "@agentation/core/ui";
export {
  identifyElement,
  identifyAnimationElement,
  getElementPath,
  getNearbyText,
  getElementClasses,
  isInShadowDOM,
  getShadowHost,
  closestCrossingShadow,
} from "@agentation/core/utils/element-identification";
export { loadAnnotations, saveAnnotations, getStorageKey } from "@agentation/core/utils/storage";
