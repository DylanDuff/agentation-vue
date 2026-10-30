// =============================================================================
// Agentation (Vue)
// =============================================================================
//
// Vue 3 adapter for Agentation: a floating toolbar for annotating web pages and
// collecting structured feedback for AI coding agents.
//
// Usage:
//   import { Agentation } from 'agentation-vue';
//   <Agentation />
//
// =============================================================================

export { PageFeedbackToolbarCSS as Agentation, PageFeedbackToolbarCSS } from "./components/agentation";
export type { AgentationProps } from "./components/agentation";
export type { DemoAnnotation } from "@agentation/core/ui";

// Component detection
export { vueDetector } from "@agentation/core/detectors/vue";
export type { ComponentDetector } from "@agentation/core/detection";

// Utilities (shared with every adapter)
export {
  identifyElement,
  identifyAnimationElement,
  getElementPath,
  getNearbyText,
  getElementClasses,
  // Shadow DOM support
  isInShadowDOM,
  getShadowHost,
  closestCrossingShadow,
} from "@agentation/core/utils/element-identification";

export { loadAnnotations, saveAnnotations, getStorageKey } from "@agentation/core/utils/storage";

// Types
export type { Annotation } from "@agentation/core/types";
