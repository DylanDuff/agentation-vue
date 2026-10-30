import { defineComponent, ref, watch, type PropType } from "vue";
import type { Annotation } from "@agentation/core/types";
import { IconEdit, IconPlus, IconXmark } from "../../icons";
import { useExitCompletion } from "../../../composables/use-exit-completion";
import { rs } from "../../../utils/react-style";
import styles from "@agentation/core/styles/page-toolbar-css/annotation-marker/styles.module.scss";

type MarkerClickBehavior = "edit" | "delete";

// =============================================================================
// AnnotationMarker
// =============================================================================

export type AnnotationMarkerProps = {
  annotation: Annotation;
  pending?: boolean;
  globalIndex: number;
  /** Display index within this layer (for staggered animation delays) */
  layerIndex: number;
  layerSize: number;
  isExiting: boolean;
  isClearing: boolean;
  isAnimated: boolean;
  isNew: boolean;
  isHovered: boolean;
  isRemoving: boolean;
  onRemoveComplete: (id: string) => void;
  isEditingAny: boolean;
  renumberFrom: number | null;
  markerClickBehavior: MarkerClickBehavior;
  onHoverEnter: (annotation: Annotation) => void;
  onEnterComplete: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onClick: (annotation: Annotation, trigger: HTMLButtonElement) => void;
  onContextMenu?: (annotation: Annotation, trigger: HTMLButtonElement) => void;
};

export const AnnotationMarker = defineComponent({
  name: "AnnotationMarker",
  props: {
    annotation: { type: Object as PropType<Annotation>, required: true },
    pending: { type: Boolean, default: false },
    globalIndex: { type: Number, required: true },
    layerIndex: { type: Number, required: true },
    layerSize: { type: Number, required: true },
    isExiting: Boolean,
    isClearing: Boolean,
    isAnimated: Boolean,
    isNew: Boolean,
    isHovered: Boolean,
    isRemoving: Boolean,
    onRemoveComplete: { type: Function as PropType<(id: string) => void>, required: true },
    isEditingAny: Boolean,
    renumberFrom: { type: Number as PropType<number | null>, default: null },
    markerClickBehavior: { type: String as PropType<MarkerClickBehavior>, required: true },
    onHoverEnter: { type: Function as PropType<(annotation: Annotation) => void>, required: true },
    onEnterComplete: { type: Function as PropType<(id: string) => void>, required: true },
    onHoverLeave: { type: Function as PropType<(id: string) => void>, required: true },
    onClick: { type: Function as PropType<(annotation: Annotation, trigger: HTMLButtonElement) => void>, required: true },
    onContextMenu: Function as PropType<(annotation: Annotation, trigger: HTMLButtonElement) => void>,
  },
  setup(props) {
    const hasEntered = ref(props.isAnimated);
    const beganPending = props.pending;
    const hasConfirmed = ref(false);
    watch(() => props.isExiting, (exiting) => { if (exiting) hasEntered.value = false; }, { flush: "sync" });
    const markerRef = ref<HTMLButtonElement | null>(null);
    // Not reactive: holds what the marker showed before removal began.
    let restingContent = { action: false, delete: false };
    useExitCompletion(markerRef, () => props.isRemoving, () => props.onRemoveComplete(props.annotation.id));

    return () => {
      const { annotation, pending, globalIndex, layerIndex, layerSize, isExiting, isClearing, isAnimated,
        isNew, isHovered, isRemoving, isEditingAny, renumberFrom, markerClickBehavior } = props;
      // Fast submissions finish the entrance already in flight, without restarting it.
      const confirming = beganPending && !pending && hasEntered.value && !hasConfirmed.value;
      const action = isHovered && !isEditingAny;
      const deleteHover = action && markerClickBehavior === "delete";
      // Preserve the visible glyph and colour while this same marker leaves.
      const showAction = isRemoving ? restingContent.action : action;
      const showDeleteHover = isRemoving ? restingContent.delete : deleteHover;
      if (!isRemoving) restingContent = { action, delete: deleteHover };
      const isMulti = annotation.isMultiSelect;

      const markerColor = isMulti ? "var(--agentation-color-green)" : "var(--agentation-color-accent)";

      const animClass = isClearing
        ? styles.clearing
        : isExiting || isRemoving
          ? styles.exit
          : confirming
            ? styles.confirm
            : !isAnimated && !hasEntered.value
              ? styles.enter
              : "";

      const animationDelay = isClearing
        ? `${Math.min(layerIndex * 20, 120)}ms`
        : isRemoving || pending || confirming
          ? "0ms"
          : isExiting
            ? `${(layerSize - 1 - layerIndex) * 20}ms`
            : `${isNew ? 0 : layerIndex * 20}ms`;

      return (
        <button
          ref={markerRef}
          type="button"
          aria-label={pending ? "Pending annotation" : `${markerClickBehavior === "delete" ? "Delete" : "Edit"} annotation ${globalIndex + 1}: ${annotation.element}`}
          disabled={pending || isExiting || isRemoving || isClearing}
          tabindex={pending || isEditingAny ? -1 : 0}
          class={`${styles.marker} ${pending ? styles.pending : ""} ${isMulti ? styles.multiSelect : ""} ${animClass} ${!pending && showAction ? styles.actionVisible : ""} ${showDeleteHover ? styles.hovered : ""} ${isHovered && !isEditingAny && !isRemoving ? styles.previewVisible : ""}`}
          data-annotation-marker={pending ? undefined : ""}
          data-annotation-pending={pending ? "" : undefined}
          style={rs({
            left: `${annotation.x}%`,
            top: annotation.y,
            backgroundColor: showDeleteHover ? undefined : markerColor,
            animationDelay,
          })}
          onAnimationend={(event: AnimationEvent) => {
            if (event.target !== event.currentTarget) return;
            if (animClass === styles.enter || animClass === styles.confirm) {
              hasEntered.value = true;
              if (!props.pending) hasConfirmed.value = true;
              if (!props.pending) props.onEnterComplete(annotation.id);
            }
          }}
          // Bubbling mouseover reaches the marker across a shadow boundary.
          onMouseover={() => { if (!pending) props.onHoverEnter(annotation); }}
          onMouseout={(event: MouseEvent) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) {
              props.onHoverLeave(annotation.id);
            }
          }}
          onFocus={(event: FocusEvent) => {
            if (!pending && (event.currentTarget as HTMLElement).matches(":focus-visible")) props.onHoverEnter(annotation);
          }}
          onBlur={() => props.onHoverLeave(annotation.id)}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            if (!pending && !isExiting && !isRemoving) props.onClick(annotation, e.currentTarget as HTMLButtonElement);
          }}
          onContextmenu={
            props.onContextMenu
              ? (e: MouseEvent) => {
                  if (markerClickBehavior === "delete") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!pending && !isExiting && !isRemoving) props.onContextMenu?.(annotation, e.currentTarget as HTMLButtonElement);
                  }
                }
              : undefined
          }
        >
          <span
            key={globalIndex}
            class={`${styles.number} ${renumberFrom !== null && globalIndex >= renumberFrom ? styles.renumber : ""}`}
            aria-hidden="true"
          >
            <span class={styles.numberGlyph}>{globalIndex + 1}</span>
          </span>
          <span class={styles.actionGlyph} aria-hidden="true">
            {markerClickBehavior === "delete" ? <IconXmark size={isMulti ? 18 : 16} /> : <IconEdit size={16} />}
          </span>
          {beganPending && <span class={styles.plus} aria-hidden="true"><IconPlus size={12} /></span>}
        </button>
      );
    };
  },
});
