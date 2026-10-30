// =============================================================================
// Agentation (Vue)
// =============================================================================
//
// Vue 3 port of Agentation: a floating toolbar for annotating web pages and
// collecting structured feedback for AI coding agents.
//
// Usage:
//   import { Agentation } from 'agentation-vue';
//   <Agentation />
//
// =============================================================================

// Main components
export { PageFeedbackToolbarCSS as Agentation } from "./components/page-toolbar-css";
export { PageFeedbackToolbarCSS } from "./components/page-toolbar-css";
export type { DemoAnnotation, AgentationProps } from "./components/page-toolbar-css";

// Shared components (for building custom UIs)
export { AnnotationPopupCSS } from "./components/annotation-popup-css";
export type {
  AnnotationPopupCSSProps,
  AnnotationPopupCSSHandle,
} from "./components/annotation-popup-css";
export { default as ShadowRoot } from "./components/shadow-root/ShadowRoot.vue";

// Icons (pure SVG functional components)
export * from "./components/icons";

// Utilities (shared with the React package)
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
