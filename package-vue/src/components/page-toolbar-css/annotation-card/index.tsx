import { defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";
import type { Annotation } from "@core/types";
import { useExitCompletion } from "../../../composables/use-exit-completion";
import type { AnnotationPopupCSSHandle } from "../../annotation-popup-css";
import {
  AnnotationEditor,
  type AnnotationEditorHandle,
  type AnnotationEditorProps,
} from "../../annotation-popup-css/annotation-editor";
import popupStyles from "@core/components/annotation-popup-css/styles.module.scss";
import styles from "@core/components/page-toolbar-css/annotation-card/styles.module.scss";

/** One heading and note field persist from read-only preview through editing. */
export const AnnotationCard = defineComponent({
  name: "AnnotationCard",
  props: {
    annotation: { type: Object as PropType<Annotation | null>, default: null },
    editing: Boolean,
    exiting: Boolean,
    restorePreview: Boolean,
    editorProps: Object as PropType<AnnotationEditorProps>,
    lightMode: Boolean,
    scrollY: { type: Number, required: true },
    onExited: { type: Function as PropType<() => void>, required: true },
  },
  setup(props, { expose }) {
    // Keeps the last shown annotation so it can animate out after deselection.
    let previous = { annotation: props.annotation, editorProps: props.editorProps };
    const displayed = () => props.annotation ?? previous.annotation;
    const surfaceRef = ref<HTMLDivElement | null>(null);
    const editorRef = ref<AnnotationEditorHandle | null>(null);
    let previousId: string | undefined;
    let previousScroll = props.scrollY;
    const mode = () =>
      props.editing && !props.exiting
        ? "edit"
        : props.annotation && (!props.editing || props.restorePreview)
          ? "preview"
          : "hidden";

    watch(
      [() => props.annotation, () => props.editorProps],
      ([annotation, editorProps]) => {
        if (annotation) previous = { annotation, editorProps };
      },
      { flush: "sync" },
    );

    let removeResize: (() => void) | undefined;
    watch(
      () => {
        const d = displayed();
        return [surfaceRef.value, d?.id, d?.x, d?.y, d?.isFixed, mode(), props.editing, props.scrollY, d?.comment];
      },
      () => {
        removeResize?.();
        removeResize = undefined;
        const surface = surfaceRef.value;
        const shown = displayed();
        if (!surface || !shown) return;
        const currentMode = mode();
        // Only morph content that was actually on screen. Opening from an empty
        // draft can reuse a hidden preview, but its text should not slide in.
        const directEntry = currentMode === "edit" && (
          previousId !== shown.id ||
          (surface.dataset.state === "hidden" && getComputedStyle(surface).opacity === "0")
        );
        if (directEntry) surface.dataset.directEntry = "true";
        const position = () => {
          const x = (shown.x / 100) * window.innerWidth;
          const y = shown.isFixed ? shown.y : shown.y - props.scrollY;
          const showingPreview = currentMode === "preview" || !props.editing;
          const previewWidth = parseFloat(surface.style.getPropertyValue("--preview-width")) || 200;
          const compactWidth = Math.min(previewWidth, window.innerWidth - 24);
          const previewLeft = Math.max(12, Math.min(window.innerWidth - compactWidth - 12, x - compactWidth / 2));
          const width = showingPreview ? compactWidth : Math.min(280, window.innerWidth - 24);
          const margin = Math.min(showingPreview ? 12 : 20, (window.innerWidth - width) / 2);
          const above = y > window.innerHeight - (showingPreview ? 101 : 290);
          // Expand from the preview's leading edge instead of dragging its shared
          // text left as the surface widens. Shift only to remain in the viewport.
          surface.style.left = `${Math.max(margin, Math.min(window.innerWidth - width - margin, previewLeft))}px`;
          surface.style.right = "auto";
          surface.style.top = `${Math.max(12, Math.min(window.innerHeight - 12, y + (above ? -21 : 21)))}px`;
          surface.style.bottom = "auto";
          surface.style.transform = above ? "translateY(-100%)" : "translateY(0)";
          surface.style.maxHeight = `${Math.max(100, above ? y - 33 : window.innerHeight - y - 33)}px`;
        };
        const jump = previousId !== shown.id || previousScroll !== props.scrollY || surface.dataset.state === "hidden";
        if (jump) surface.dataset.positioning = "true";
        position();
        if (jump || directEntry) surface.getBoundingClientRect();
        delete surface.dataset.positioning;
        delete surface.dataset.directEntry;
        surface.dataset.state = currentMode;
        surface.inert = currentMode !== "edit";
        previousId = shown.id;
        previousScroll = props.scrollY;
        const onResize = () => {
          surface.dataset.positioning = "true";
          position();
          surface.getBoundingClientRect();
          delete surface.dataset.positioning;
        };
        window.addEventListener("resize", onResize);
        removeResize = () => window.removeEventListener("resize", onResize);
      },
      { flush: "post", immediate: true },
    );
    onBeforeUnmount(() => removeResize?.());

    watch(
      [() => props.editing, () => props.exiting, () => displayed()?.id, editorRef],
      () => {
        if (props.editing && !props.exiting) editorRef.value?.focus();
      },
      { flush: "post", immediate: true },
    );
    useExitCompletion(surfaceRef, () => props.exiting, () => props.onExited());

    expose({
      shake() {
        surfaceRef.value?.animate?.(
          [
            { translate: "0px" },
            { translate: "-3px" },
            { translate: "3px" },
            { translate: "-2px" },
            { translate: "2px" },
            { translate: "0px" },
          ],
          { duration: 250 },
        );
        editorRef.value?.focus();
      },
    } satisfies AnnotationPopupCSSHandle);

    return () => {
      const shown = displayed();
      const formProps = props.annotation ? props.editorProps : previous.editorProps;
      if (!shown || !formProps) return null;
      const currentMode = mode();
      const preview = currentMode === "preview" || !props.editing;
      return (
        <div
          ref={surfaceRef}
          class={`${popupStyles.popup} ${styles.surface} ${props.lightMode ? popupStyles.light : ""}`}
          data-feedback-toolbar
          data-annotation-card
          data-annotation-popup={props.editing ? "" : undefined}
          data-state="hidden"
          aria-hidden={currentMode === "hidden"}
          onClick={(event: MouseEvent) => event.stopPropagation()}
          {...{
            onKeydownCapture: (event: KeyboardEvent) => {
              if (event.key !== "Escape" || event.isComposing || !props.editing) return;
              event.preventDefault();
              event.stopPropagation();
              formProps.onCancel();
            },
          }}
        >
          <AnnotationEditor
            key={shown.id}
            ref={editorRef}
            {...formProps}
            variant="card"
            preview={preview}
            resetOnPreview={!props.editing}
            disabled={!props.editing || props.exiting}
          />
        </div>
      );
    };
  },
});
