// =============================================================================
// Agentation
// =============================================================================
//
// A floating toolbar for annotating web pages and collecting structured feedback
// for AI coding agents.
//
// Usage:
//   import { Agentation } from 'agentation';
//   <Agentation />
//
// =============================================================================

// Main components
// CSS-only version (default - zero runtime deps)
export { PageFeedbackToolbarCSS as Agentation } from "./components";
export { PageFeedbackToolbarCSS } from "./components";
export type { DemoAnnotation, AgentationProps } from "@agentation/core/ui";

// Shared components (for building custom UIs)
export { AnnotationPopupCSS } from "@agentation/core/ui";
export type {
  AnnotationPopupCSSProps,
  AnnotationPopupCSSHandle,
} from "@agentation/core/ui";

// Icons (same for both versions - they're pure SVG)
export * from "@agentation/core/ui";

// Utilities (for building custom UIs)
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

export {
  loadAnnotations,
  saveAnnotations,
  getStorageKey,
} from "@agentation/core/utils/storage";

// Types
export type { Annotation } from "@agentation/core/types";
