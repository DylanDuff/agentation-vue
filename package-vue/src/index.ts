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

export { default as ShadowRoot } from "./components/shadow-root/ShadowRoot.vue";

// Utilities (shared with the React package)
export {
  identifyElement,
  identifyAnimationElement,
  getElementPath,
  getNearbyText,
  getElementClasses,
  isInShadowDOM,
  getShadowHost,
  closestCrossingShadow,
} from "@core/utils/element-identification";

export { loadAnnotations, saveAnnotations, getStorageKey } from "@core/utils/storage";

export type { Annotation } from "@core/types";
