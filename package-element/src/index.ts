// =============================================================================
// Agentation custom element
// =============================================================================
//
// The Agentation toolbar for any framework, or none:
//
//   import { defineAgentationElement } from 'agentation-element';
//   defineAgentationElement();
//   // <agentation-feedback endpoint="http://localhost:4747"></agentation-feedback>
//
// or imperatively: mountAgentation(document.body.appendChild(document.createElement('div')))
//
// =============================================================================

export { AgentationElement, defineAgentationElement, AGENTATION_ELEMENT_TAG } from "./element";
export type { AgentationEventMap } from "./element";
export { mountAgentation, createStableCallbacks, DEFAULT_DETECTORS } from "./mount";
export type { AgentationOptions, AgentationInstance } from "./mount";

// Component detectors, for choosing which frameworks to detect
export type { ComponentDetector } from "@agentation/core/detection";
export { vueDetector } from "@agentation/core/detectors/vue";
export { svelteDetector } from "@agentation/core/detectors/svelte";
export { reactNamesDetector } from "@agentation/core/detectors/react";

// Utilities (shared with every adapter)
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

export type { Annotation } from "@agentation/core/types";
export type { DemoAnnotation } from "@agentation/core/ui";
