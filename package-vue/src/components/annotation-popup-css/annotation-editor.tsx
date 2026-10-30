import { defineComponent, onBeforeUnmount, ref, watch, type CSSProperties, type PropType } from "vue";
import { originalSetTimeout } from "@core/utils/freeze-animations";
import styles from "@core/components/annotation-popup-css/styles.module.scss";

/** Focus an element while temporarily blocking focus-trap libraries (e.g. Radix
 *  FocusScope) from reclaiming focus via focusin/focusout handlers. */
function focusBypassingTraps(el: HTMLElement | null) {
  if (!el) return;
  const trap = (e: Event) => e.stopImmediatePropagation();
  document.addEventListener("focusin", trap, true);
  document.addEventListener("focusout", trap, true);
  try {
    el.focus({ preventScroll: true });
  } finally {
    document.removeEventListener("focusin", trap, true);
    document.removeEventListener("focusout", trap, true);
  }
}

export type AnnotationEditorProps = {
  element: string;
  timestamp?: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onOpenSource?: () => void;
  allowEmpty?: boolean;
  accentColor?: string;
  computedStyles?: Record<string, string>;
  disabled?: boolean;
  preview?: boolean;
  resetOnPreview?: boolean;
  variant?: "popup" | "card";
};

export type AnnotationEditorHandle = { focus: () => void };

/** The form is shared by new-note popups and the saved-note preview card. */
export const AnnotationEditor = defineComponent({
  name: "AnnotationEditor",
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
    accentColor: { type: String, default: "#3c82f7" },
    computedStyles: Object as PropType<Record<string, string>>,
    disabled: { type: Boolean, default: false },
    preview: { type: Boolean, default: false },
    resetOnPreview: { type: Boolean, default: true },
    variant: { type: String as PropType<"popup" | "card">, default: "popup" },
  },
  setup(props, { expose }) {
    const isCard = () => props.variant === "card";
    const text = ref(props.initialValue);
    const isFocused = ref(false);
    const isStylesExpanded = ref(false);
    const textareaRef = ref<HTMLTextAreaElement | null>(null);
    const formRef = ref<HTMLDivElement | null>(null);
    const previewExcerpt = () =>
      props.selectedText
        ? ` "${props.selectedText.slice(0, 30)}${props.selectedText.length > 30 ? "..." : ""}"`
        : "";

    let observer: ResizeObserver | null = null;
    watch(
      [isCard, () => props.element, () => props.initialValue, previewExcerpt, formRef, textareaRef],
      () => {
        observer?.disconnect();
        observer = null;
        const form = formRef.value;
        const textarea = textareaRef.value;
        if (!isCard() || !form || !textarea) return;
        const measure = () => {
          form.style.setProperty("--editor-field-height", `${textarea.offsetHeight}px`);
        };
        measure();
        // Canvas measures the existing text without adding a second renderer.
        if ("CanvasRenderingContext2D" in window) {
          const context = document.createElement("canvas").getContext("2d");
          if (context) {
            const family = getComputedStyle(textarea).fontFamily;
            context.font = `13px ${family}`;
            const noteWidth = context.measureText(props.initialValue.replace(/\s+/g, " ")).width;
            context.font = `italic 12px ${family}`;
            const headingWidth = context.measureText(props.element + previewExcerpt()).width;
            const width = Math.min(200, Math.max(120, Math.ceil(Math.max(noteWidth, headingWidth)) + 24));
            form.closest<HTMLElement>("[data-annotation-card]")?.style.setProperty("--preview-width", `${width}px`);
            const note = form.querySelector<HTMLElement>("[data-shared-note]");
            if (note) note.toggleAttribute("data-truncated", noteWidth > width - 24);
          }
        }
        observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        observer?.observe(textarea);
      },
      { flush: "post", immediate: true },
    );
    onBeforeUnmount(() => observer?.disconnect());

    watch(
      [() => props.preview, () => props.resetOnPreview, () => props.initialValue],
      () => {
        if (props.preview && props.resetOnPreview) {
          text.value = props.initialValue;
          isStylesExpanded.value = false;
          if (textareaRef.value) {
            textareaRef.value.scrollTop = 0;
            textareaRef.value.scrollLeft = 0;
          }
        }
      },
      { flush: "post", immediate: true },
    );

    expose({
      focus() {
        const textarea = textareaRef.value;
        focusBypassingTraps(textarea);
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = isCard() ? 0 : textarea.scrollHeight;
        }
      },
    } satisfies AnnotationEditorHandle);

    const handleSubmit = () => {
      if (props.disabled || (!text.value.trim() && !props.allowEmpty)) return;
      props.onSubmit(text.value.trim());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
      if (event.key === "Escape") props.onCancel();
    };

    return () => {
      const card = isCard();
      const excerpt = previewExcerpt();
      const contents: CSSProperties | undefined = card ? undefined : { display: "contents" };
      const { computedStyles, selectedText, accentColor } = props;
      const hasStyles = !!computedStyles && Object.keys(computedStyles).length > 0;
      const elementLabel = (
        <span class={styles.element}>
          {props.element}
          {card && excerpt && <span class={styles.previewExcerpt}>{excerpt}</span>}
        </span>
      );

      return (
        <div
          ref={formRef}
          class={card ? styles.sharedForm : undefined}
          style={contents}
          data-annotation-editor
          data-preview={props.preview || undefined}
        >
          <div class={styles.header} data-editor-heading>
            {hasStyles ? (
              <button
                class={styles.headerToggle}
                onClick={() => {
                  const wasExpanded = isStylesExpanded.value;
                  isStylesExpanded.value = !isStylesExpanded.value;
                  if (wasExpanded) {
                    // Refocus textarea when closing
                    originalSetTimeout(() => focusBypassingTraps(textareaRef.value), 0);
                  }
                }}
                type="button"
              >
                <svg
                  class={`${styles.chevron} ${isStylesExpanded.value ? styles.expanded : ""}`}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.5 10.25L9 7.25L5.75 4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {elementLabel}
              </button>
            ) : (
              elementLabel
            )}
            {props.timestamp && <span class={styles.timestamp}>{props.timestamp}</span>}
          </div>

          {props.onOpenSource && (
            <div class={card ? styles.sharedExtra : undefined} style={contents}>
              <div class={card ? styles.sharedExtraInner : undefined} style={contents}>
                <button type="button" class={styles.sourceAction} onClick={() => props.onOpenSource?.()}>
                  Open in editor
                </button>
              </div>
            </div>
          )}

          {/* Collapsible computed styles section - uses grid-template-rows for smooth animation */}
          {hasStyles && (
            <div class={`${styles.stylesWrapper} ${isStylesExpanded.value ? styles.expanded : ""}`}>
              <div class={styles.stylesInner}>
                <div class={styles.stylesBlock}>
                  {Object.entries(computedStyles!).map(([key, value]) => (
                    <div key={key} class={styles.styleLine}>
                      <span class={styles.styleProperty}>{key.replace(/([A-Z])/g, "-$1").toLowerCase()}</span>
                      : <span class={styles.styleValue}>{value}</span>;
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedText && (
            <div class={card ? styles.sharedExtra : undefined} style={contents}>
              <div class={card ? styles.sharedExtraInner : undefined} style={contents}>
                <div class={styles.quote}>
                  &ldquo;{selectedText.slice(0, 80)}
                  {selectedText.length > 80 ? "..." : ""}&rdquo;
                </div>
              </div>
            </div>
          )}

          <div
            data-shared-note
            class={card ? styles.sharedNote : undefined}
            style={card ? ({ "--field-border": isFocused.value ? accentColor : undefined } as CSSProperties) : contents}
          >
            <div class={card ? styles.sharedNoteContent : undefined} style={contents}>
              <textarea
                ref={textareaRef}
                class={styles.textarea}
                readonly={props.preview}
                aria-hidden={props.preview}
                style={card ? undefined : { borderColor: isFocused.value ? accentColor : undefined }}
                placeholder={props.placeholder}
                value={props.preview ? text.value.replace(/\s+/g, " ") : text.value}
                onInput={(e) => { text.value = (e.target as HTMLTextAreaElement).value; }}
                onFocus={() => { isFocused.value = true; }}
                onBlur={() => { isFocused.value = false; }}
                rows={2}
                onKeydown={handleKeyDown}
              />
            </div>
          </div>

          <div data-editor-actions class={card ? styles.sharedActions : undefined} style={contents}>
            <div class={styles.actions}>
              {props.onDelete && (
                <div class={styles.deleteWrapper}>
                  <button
                    class={styles.deleteButton}
                    onClick={() => props.onDelete?.()}
                    type="button"
                    aria-label="Delete annotation"
                  >
                    Delete
                  </button>
                </div>
              )}
              <button class={styles.cancel} onClick={() => props.onCancel()}>
                Cancel
              </button>
              <button
                class={styles.submit}
                style={{
                  backgroundColor: accentColor,
                  opacity: text.value.trim() || props.allowEmpty ? 1 : 0.4,
                }}
                onClick={handleSubmit}
                disabled={props.disabled || (!text.value.trim() && !props.allowEmpty)}
              >
                {props.submitLabel}
              </button>
            </div>
          </div>
        </div>
      );
    };
  },
});
