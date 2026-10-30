// The shared Agentation toolbar (rendered with Preact inside the page's
// shadow DOM) mounted from a Vue component. Vue only passes props through:
// all behaviour lives in @agentation/core, the same code the React package runs.
import { defineComponent, h, normalizeClass, onBeforeUnmount, onMounted, shallowRef, watchEffect, type PropType } from "vue";
import { createStableCallbacks, mountAgentation, type AgentationInstance, type AgentationOptions } from "agentation-element/mount";
import type { ComponentDetector } from "@agentation/core/detection";
import { vueDetector } from "@agentation/core/detectors/vue";
import type { Annotation } from "@agentation/core/types";
import type { CopyFormat } from "@agentation/core/utils/copy-format";
import type { DemoAnnotation } from "@agentation/core/ui";

type Fn<T> = PropType<T>;

const VUE_DETECTORS: readonly ComponentDetector[] = [vueDetector];

// Boolean props default to undefined so the toolbar's own defaults apply
const toolbarProps = {
  demoAnnotations: Array as PropType<DemoAnnotation[]>,
  demoDelay: Number,
  enableDemoMode: { type: Boolean, default: undefined },
  onAnnotationAdd: Function as Fn<(annotation: Annotation) => void>,
  onAnnotationDelete: Function as Fn<(annotation: Annotation) => void>,
  onAnnotationUpdate: Function as Fn<(annotation: Annotation) => void>,
  onAnnotationsClear: Function as Fn<(annotations: Annotation[]) => void>,
  onCopy: Function as Fn<(output: string) => void>,
  onSubmit: Function as Fn<(output: string, annotations: Annotation[]) => void | Promise<void>>,
  copyToClipboard: { type: Boolean, default: undefined },
  endpoint: String,
  sessionId: String,
  onSessionCreated: Function as Fn<(sessionId: string) => void>,
  webhookUrl: String,
  className: String,
  useHashLocation: { type: Boolean, default: undefined },
  appName: String,
  enableKeyboardShortcuts: { type: Boolean, default: undefined },
  identifyingAttributes: Array as unknown as PropType<readonly string[]>,
  copyFormat: [String, Object] as PropType<CopyFormat>,
  onOpenSource: Function as Fn<(sourceFile: string) => void>,
  portalContainer: Object as PropType<HTMLElement | ShadowRoot | null>,
  /** Replaces the Vue component detector, e.g. to add another framework's */
  detectors: Array as PropType<readonly ComponentDetector[]>,
} as const;

export const PageFeedbackToolbarCSS = defineComponent({
  name: "Agentation",
  inheritAttrs: false,
  props: toolbarProps,
  setup(props, { attrs }) {
    const anchor = shallowRef<HTMLElement | null>(null);
    let instance: AgentationInstance | null = null;
    let isDevMode = false;

    // Inline template handlers are new on every render; keep the toolbar's stable
    const stabilize = createStableCallbacks();

    const options = (): AgentationOptions => {
      const passed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (value !== undefined) passed[key] = value;
      }
      return stabilize({
        ...passed,
        className: normalizeClass([props.className, attrs.class]) || undefined,
        detectors: props.detectors ?? VUE_DETECTORS,
        isDevMode,
      });
    };

    onMounted(() => {
      const element = anchor.value!;
      // Vue links elements to their component only in development builds
      isDevMode = "__vueParentComponent" in element;
      instance = mountAgentation(element, options());
      watchEffect(() => instance?.update(options()), { flush: "post" });
    });
    onBeforeUnmount(() => {
      instance?.destroy();
      instance = null;
    });

    return () => h("span", { ref: anchor, style: { display: "contents" }, "data-agentation-vue": "" });
  },
});

export type AgentationProps = AgentationOptions;
