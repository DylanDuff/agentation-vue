import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from "vue";
import { useExitCompletion } from "../../composables/use-exit-completion";
import styles, { css as popupCss } from "@agentation/core/styles/annotation-popup-css/styles.module.scss";
import { ensureStyles } from "@agentation/core/utils/ensure-styles";
import { AnnotationEditor, type AnnotationEditorHandle } from "./annotation-editor";
import { originalSetTimeout } from "@agentation/core/utils/freeze-animations";

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopupCSSProps {
  /** Element name to display in header */
  element: string;
  /** Optional timestamp display (e.g., "@ 1.23s" for animation feedback) */
  timestamp?: string;
  /** Optional selected/highlighted text */
  selectedText?: string;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Initial value for textarea (for edit mode) */
  initialValue?: string;
  /** Label for submit button (default: "Add") */
  submitLabel?: string;
  /** Called when annotation is submitted with text (`@submit` in templates) */
  onSubmit: (text: string) => void;
  /** Called when popup is cancelled/dismissed (`@cancel`) */
  onCancel: () => void;
  /** Called when delete button is clicked (only shown if provided) */
  onDelete?: () => void;
  /** Optional host-provided action for opening the detected source in an editor. */
  onOpenSource?: () => void;
  /** Attribute-only selection can be saved without a feedback comment. */
  allowEmpty?: boolean;
  /** Position styles (left, top) */
  style?: CSSProperties;
  /** Custom color for submit button and textarea focus (hex) */
  accentColor?: string;
  /** External exit state (parent controls exit animation) */
  isExiting?: boolean;
  /** Called after the externally controlled exit animation finishes. */
  onExitComplete?: () => void;
  /** Light mode styling */
  lightMode?: boolean;
  /** Computed styles for the selected element */
  computedStyles?: Record<string, string>;
}

export interface AnnotationPopupCSSHandle {
  /** Shake the popup (e.g., when user clicks outside) */
  shake: () => void;
}

// =============================================================================
// Component
// =============================================================================

// Callbacks are props (not emits) so presence checks like `onDelete` keep the
// React behaviour. Templates can still bind them as `@submit`, `@delete`, etc.
export const AnnotationPopupCSS = defineComponent({
  name: "AnnotationPopupCSS",
  props: {
    element: { type: String, required: true },
    timestamp: String,
    selectedText: String,
    placeholder: { type: String, default: "What should change?" },
    initialValue: { type: String, default: "" },
    submitLabel: { type: String, default: "Add" },
    onSubmit: { type: Function as PropType<(text: string) => void>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
    onDelete: Function as PropType<() => void>,
    onOpenSource: Function as PropType<() => void>,
    allowEmpty: { type: Boolean, default: false },
    style: Object as PropType<CSSProperties>,
    accentColor: { type: String, default: "#3c82f7" },
    isExiting: { type: Boolean, default: false },
    onExitComplete: Function as PropType<() => void>,
    lightMode: { type: Boolean, default: false },
    computedStyles: Object as PropType<Record<string, string>>,
  },
  setup(props, { expose }) {
    const isShaking = ref(false);
    const animState = ref<"initial" | "enter" | "entered" | "exit">("initial");
    const editorRef = ref<AnnotationEditorHandle | null>(null);
    const popupRef = ref<HTMLDivElement | null>(null);
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
      ensureStyles(popupRef.value?.getRootNode(), "annotation-popup", popupCss);
      // Start enter animation (use originalSetTimeout to bypass freeze patch)
      startTimer = originalSetTimeout(() => {
        if (animState.value === "initial") animState.value = "enter";
      }, 0);
    });
    onBeforeUnmount(() => {
      if (startTimer) clearTimeout(startTimer);
      if (shakeTimer) clearTimeout(shakeTimer);
    });

    watch(
      () => props.isExiting,
      (isExiting, _, onCleanup) => {
        if (isExiting) return;
        const timer = originalSetTimeout(() => editorRef.value?.focus(), 50);
        onCleanup(() => clearTimeout(timer));
      },
      { immediate: true },
    );

    // Shake animation
    const shake = () => {
      if (shakeTimer) clearTimeout(shakeTimer);
      isShaking.value = true;
      shakeTimer = originalSetTimeout(() => {
        isShaking.value = false;
        editorRef.value?.focus();
      }, 250);
    };

    // Expose shake to parent via ref
    expose({ shake } satisfies AnnotationPopupCSSHandle);

    // Handle cancel with exit animation
    const handleCancel = () => {
      if (props.onExitComplete) {
        props.onCancel();
        return;
      }
      animState.value = "exit";
    };

    const visibleAnimState = computed(() => (props.isExiting ? "exit" : animState.value));
    useExitCompletion(popupRef, () => visibleAnimState.value === "exit", () => {
      if (props.isExiting) props.onExitComplete?.();
      else props.onCancel();
    });

    return () => {
      const state = visibleAnimState.value;
      const popupClassName = [
        styles.popup,
        props.lightMode ? styles.light : "",
        state === "enter" ? styles.enter : "",
        state === "entered" ? styles.entered : "",
        state === "exit" ? styles.exit : "",
        isShaking.value && state !== "exit" ? styles.shake : "",
      ].filter(Boolean).join(" ");

      return (
        <div
          ref={popupRef}
          class={popupClassName}
          data-annotation-popup
          style={props.style}
          onAnimationend={(event: AnimationEvent) => {
            if (event.target !== event.currentTarget) return;
            if (event.animationName.includes("popupEnter") && !props.isExiting) {
              animState.value = "entered";
            }
          }}
          {...{
            // Vue's runtime reads the Capture suffix as a capture-phase listener
            onKeydownCapture: (event: KeyboardEvent) => {
              if (event.key !== "Escape" || event.isComposing) return;
              event.preventDefault();
              event.stopPropagation();
              handleCancel();
            },
          }}
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          <AnnotationEditor
            ref={editorRef}
            element={props.element}
            timestamp={props.timestamp}
            selectedText={props.selectedText}
            placeholder={props.placeholder}
            initialValue={props.initialValue}
            submitLabel={props.submitLabel}
            onSubmit={props.onSubmit}
            onCancel={handleCancel}
            onDelete={props.onDelete}
            onOpenSource={props.onOpenSource}
            allowEmpty={props.allowEmpty}
            accentColor={props.accentColor}
            computedStyles={props.computedStyles}
            disabled={state === "exit"}
          />
        </div>
      );
    };
  },
});

export default AnnotationPopupCSS;
