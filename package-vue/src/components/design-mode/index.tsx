import { defineComponent, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from "vue";
import type { JSX } from "vue/jsx-runtime";
import { COMPONENT_MAP, DEFAULT_SIZES, type ComponentType, type DesignPlacement } from "@core/components/design-mode/types";
import { Skeleton } from "./skeletons";
import { AnnotationPopupCSS } from "../annotation-popup-css";
import styles from "@core/components/design-mode/styles.module.scss";
import { originalSetTimeout } from "@core/utils/freeze-animations";
import { useWindowScroll } from "../../composables/use-window-scroll";
import { rs } from "../../utils/react-style";

// =============================================================================
// Layout Mode Overlay
// =============================================================================

export type DesignModeProps = {
  placements: DesignPlacement[];
  onChange: (placements: DesignPlacement[]) => void;
  activeComponent: ComponentType | null;
  onActiveComponentChange: (type: ComponentType | null) => void;
  isDarkMode: boolean;
  exiting?: boolean;
  onInteractionChange?: (active: boolean) => void;
  className?: string;
  passthrough?: boolean;
  extraSnapRects?: SnapRect[];
  onSelectionChange?: (selectedIds: Set<string>, isShift: boolean) => void;
  deselectSignal?: number;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number, committed: boolean) => void;
  clearingPlacements?: DesignPlacement[];
  wireframe?: boolean;
};
type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type Guide = { axis: "x" | "y"; pos: number };

const MIN_SIZE = 24;
const SNAP_THRESHOLD = 5;

type SnapRect = { x: number; y: number; width: number; height: number };

function computeSnap(
  rect: SnapRect,
  others: DesignPlacement[],
  excludeIds: Set<string>,
  activeEdges?: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean },
  extraRects?: SnapRect[],
): { dx: number; dy: number; guides: Guide[] } {
  let bestDx = Infinity;
  let bestDy = Infinity;

  const mL = rect.x, mR = rect.x + rect.width, mCx = rect.x + rect.width / 2;
  const mT = rect.y, mB = rect.y + rect.height, mCy = rect.y + rect.height / 2;

  const checkAll = !activeEdges;
  const xFroms = checkAll ? [mL, mR, mCx] : [
    ...(activeEdges.left ? [mL] : []),
    ...(activeEdges.right ? [mR] : []),
  ];
  const yFroms = checkAll ? [mT, mB, mCy] : [
    ...(activeEdges.top ? [mT] : []),
    ...(activeEdges.bottom ? [mB] : []),
  ];

  // Build unified list of snap target rects
  const allTargets: SnapRect[] = [];
  for (const o of others) {
    if (!excludeIds.has(o.id)) allTargets.push(o);
  }
  if (extraRects) allTargets.push(...extraRects);

  for (const o of allTargets) {
    const oL = o.x, oR = o.x + o.width, oCx = o.x + o.width / 2;
    const oT = o.y, oB = o.y + o.height, oCy = o.y + o.height / 2;

    for (const from of xFroms) {
      for (const to of [oL, oR, oCx]) {
        const d = to - from;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDx)) bestDx = d;
      }
    }
    for (const from of yFroms) {
      for (const to of [oT, oB, oCy]) {
        const d = to - from;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDy)) bestDy = d;
      }
    }
  }

  const dx = Math.abs(bestDx) < SNAP_THRESHOLD ? bestDx : 0;
  const dy = Math.abs(bestDy) < SNAP_THRESHOLD ? bestDy : 0;

  // Collect guide lines at snapped positions
  const guides: Guide[] = [];
  const seen = new Set<string>();
  const sL = mL + dx, sR = mR + dx, sCx = mCx + dx;
  const sT = mT + dy, sB = mB + dy, sCy = mCy + dy;

  for (const o of allTargets) {
    const oL = o.x, oR = o.x + o.width, oCx = o.x + o.width / 2;
    const oT = o.y, oB = o.y + o.height, oCy = o.y + o.height / 2;

    for (const xPos of [oL, oCx, oR]) {
      for (const sx of [sL, sCx, sR]) {
        if (Math.abs(sx - xPos) < 0.5) {
          const key = `x:${Math.round(xPos)}`;
          if (!seen.has(key)) { seen.add(key); guides.push({ axis: "x", pos: xPos }); }
        }
      }
    }
    for (const yPos of [oT, oCy, oB]) {
      for (const sy of [sT, sCy, sB]) {
        if (Math.abs(sy - yPos) < 0.5) {
          const key = `y:${Math.round(yPos)}`;
          if (!seen.has(key)) { seen.add(key); guides.push({ axis: "y", pos: yPos }); }
        }
      }
    }
  }

  return { dx, dy, guides };
}

function generateId() {
  return `dp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- Text editing config ---
const TEXT_PLACEHOLDERS: Partial<Record<ComponentType, string>> = {
  hero: "Headline text",
  button: "Button label",
  badge: "Badge label",
  cta: "Call to action text",
  toast: "Notification message",
  modal: "Dialog title",
  card: "Card title",
  navigation: "Brand / nav items",
  tabs: "Tab labels",
  input: "Placeholder text",
  search: "Search placeholder",
  pricing: "Plan name or price",
  testimonial: "Quote text",
  alert: "Alert message",
  banner: "Banner text",
  tag: "Tag label",
  notification: "Notification message",
  stat: "Metric value",
  productCard: "Product name",
};

// Handlers read props when an interaction starts, the same values the React
// handler closures captured in the render that attached them.
export const DesignMode = defineComponent({
  name: "DesignMode",
  props: {
    placements: { type: Array as PropType<DesignPlacement[]>, required: true },
    onChange: { type: Function as PropType<(placements: DesignPlacement[]) => void>, required: true },
    activeComponent: { type: String as PropType<ComponentType | null>, default: null },
    onActiveComponentChange: { type: Function as PropType<(type: ComponentType | null) => void>, required: true },
    isDarkMode: Boolean,
    exiting: Boolean,
    onInteractionChange: Function as PropType<(active: boolean) => void>,
    className: String,
    passthrough: Boolean,
    extraSnapRects: Array as PropType<SnapRect[]>,
    onSelectionChange: Function as PropType<(selectedIds: Set<string>, isShift: boolean) => void>,
    deselectSignal: Number,
    onDragMove: Function as PropType<(dx: number, dy: number) => void>,
    onDragEnd: Function as PropType<(dx: number, dy: number, committed: boolean) => void>,
    clearingPlacements: Array as PropType<DesignPlacement[]>,
    wireframe: Boolean,
  },
  setup(props) {
    const selectedIds = ref<Set<string>>(new Set());
    const drawBox = ref<{ x: number; y: number; w: number; h: number } | null>(null);
    const selectBox = ref<{ x: number; y: number; w: number; h: number } | null>(null);
    const sizeIndicator = ref<{ x: number; y: number; text: string } | null>(null);
    const guides = ref<Guide[]>([]);
    const editingId = ref<string | null>(null);
    const editExiting = ref(false);
    let editHadText = false;
    const exitingIds = ref<Set<string>>(new Set());
    const lastAnnotationText = new Map<string, string>();
    const overlayRef = ref<HTMLDivElement | null>(null);
    let interaction: string | null = null; // "place" | "move" | "resize" | "select"
    const scrollY = useWindowScroll();

    // Clear selection when the other overlay signals deselect
    watch(() => props.deselectSignal, () => { selectedIds.value = new Set(); });

    // Clear-all removal is owned by the toolbar, which preserves later edits.
    watch(
      () => props.clearingPlacements,
      (clearingPlacements) => {
        if (clearingPlacements?.length) {
          selectedIds.value = new Set([...selectedIds.value].filter((id) => !clearingPlacements.some((p) => p.id === id)));
          interaction = null;
        }
      },
      { immediate: true },
    );

    // --- Keyboard: arrow nudge, delete, escape ---
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = (e.composedPath()[0] || e.target) as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isTyping) return;
      const selected = selectedIds.value;

      // Delete selected (animate out, then remove)
      if ((e.key === "Backspace" || e.key === "Delete") && selected.size > 0) {
        e.preventDefault();
        const toDelete = new Set(selected);
        exitingIds.value = toDelete;
        selectedIds.value = new Set();
        originalSetTimeout(() => {
          props.onChange(props.placements.filter((p) => !toDelete.has(p.id)));
          exitingIds.value = new Set();
        }, 180);
        return;
      }

      // Arrow nudge
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selected.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        props.onChange(
          props.placements.map((p) =>
            selected.has(p.id) ? { ...p, x: Math.max(0, p.x + dx), y: Math.max(0, p.y + dy) } : p,
          ),
        );
        return;
      }

      // Escape: deselect palette → deselect all
      if (e.key === "Escape") {
        if (props.activeComponent) {
          props.onActiveComponentChange(null);
        } else if (selected.size > 0) {
          selectedIds.value = new Set();
        }
        return;
      }
    };
    onMounted(() => document.addEventListener("keydown", handleKeyDown));
    onBeforeUnmount(() => document.removeEventListener("keydown", handleKeyDown));

    // --- Click on empty space: place or start select box ---
    const handleOverlayMouseDown = (e: MouseEvent) => {
      // Only handle left click on the overlay itself
      if (e.button !== 0) return;
      if (props.passthrough) return; // Let clicks fall through to rearrange
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.placement}`)) return;

      e.preventDefault();
      e.stopPropagation();

      const { activeComponent, placements, onChange, onInteractionChange, onActiveComponentChange } = props;
      const selected = selectedIds.value;
      const scrollY = window.scrollY;
      const startX = e.clientX;
      const startY = e.clientY;

      if (activeComponent) {
        // --- Place by click or drag ---
        interaction = "place";
        onInteractionChange?.(true);
        let isDrag = false;
        let endX = startX;
        let endY = startY;

        const onMove = (ev: MouseEvent) => {
          endX = ev.clientX;
          endY = ev.clientY;
          const dx = Math.abs(endX - startX);
          const dy = Math.abs(endY - startY);
          if (dx > 5 || dy > 5) isDrag = true;

          if (isDrag) {
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const w = Math.abs(endX - startX);
            const h = Math.abs(endY - startY);
            drawBox.value = { x, y, w, h };
            sizeIndicator.value = { x: ev.clientX + 12, y: ev.clientY + 12, text: `${Math.round(w)} × ${Math.round(h)}` };
          }
        };

        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          drawBox.value = null;
          sizeIndicator.value = null;
          interaction = null;
          onInteractionChange?.(false);

          const def = DEFAULT_SIZES[activeComponent];
          let x: number, y: number, w: number, h: number;

          if (isDrag) {
            x = Math.min(startX, endX);
            y = Math.min(startY, endY) + scrollY;
            w = Math.max(MIN_SIZE, Math.abs(endX - startX));
            h = Math.max(MIN_SIZE, Math.abs(endY - startY));
          } else {
            w = def.width;
            h = def.height;
            x = startX - w / 2;
            y = startY + scrollY - h / 2;
          }

          x = Math.max(0, x);
          y = Math.max(0, y);

          const placement: DesignPlacement = {
            id: generateId(),
            type: activeComponent,
            x,
            y,
            width: w,
            height: h,
            scrollY,
            timestamp: Date.now(),
          };

          onChange([...placements, placement]);
          selectedIds.value = new Set([placement.id]);

          // Clear active component so overlay goes passthrough (allows rearrange clicks)
          onActiveComponentChange(null);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      } else {
        // --- Deselect and start select box ---
        if (!e.shiftKey) {
          selectedIds.value = new Set();
        }

        interaction = "select";
        let isDrag = false;

        const onMove = (ev: MouseEvent) => {
          const dx = Math.abs(ev.clientX - startX);
          const dy = Math.abs(ev.clientY - startY);
          if (dx > 4 || dy > 4) isDrag = true;

          if (isDrag) {
            const x = Math.min(startX, ev.clientX);
            const y = Math.min(startY, ev.clientY);
            selectBox.value = { x, y, w: Math.abs(ev.clientX - startX), h: Math.abs(ev.clientY - startY) };
          }
        };

        const onUp = (ev: MouseEvent) => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          interaction = null;

          if (isDrag) {
            const boxX = Math.min(startX, ev.clientX);
            const boxY = Math.min(startY, ev.clientY) + scrollY;
            const boxW = Math.abs(ev.clientX - startX);
            const boxH = Math.abs(ev.clientY - startY);

            const newSelected = new Set(e.shiftKey ? selected : new Set<string>());
            for (const p of placements) {
              if (p.x + p.width > boxX && p.x < boxX + boxW && p.y + p.height > boxY && p.y < boxY + boxH) {
                newSelected.add(p.id);
              }
            }
            selectedIds.value = newSelected;
          }

          selectBox.value = null;
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }
    };

    // --- Click on a placement: select ---
    const handlePlacementMouseDown = (e: MouseEvent, id: string) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.handle}`) || target.closest(`.${styles.deleteButton}`)) return;

      e.preventDefault();
      e.stopPropagation();

      const { placements, onChange, onInteractionChange, extraSnapRects } = props;
      const selected = selectedIds.value;

      // Select
      let newSelected: Set<string>;
      if (e.shiftKey) {
        newSelected = new Set(selected);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
      } else if (!selected.has(id)) {
        newSelected = new Set([id]);
      } else {
        newSelected = new Set(selected);
      }
      selectedIds.value = newSelected;
      // Only notify if selection actually changed (avoids deselecting other overlay when clicking an already-selected item to drag)
      const changed = newSelected.size !== selected.size || [...newSelected].some((x) => !selected.has(x));
      if (changed) props.onSelectionChange?.(newSelected, e.shiftKey);

      // Start drag-to-move
      const startX = e.clientX;
      const startY = e.clientY;

      const startPositions = new Map<string, { x: number; y: number }>();
      for (const p of placements) {
        if (newSelected.has(p.id)) {
          startPositions.set(p.id, { x: p.x, y: p.y });
        }
      }

      interaction = "move";
      onInteractionChange?.(true);
      let moved = false;
      let duplicated = false;
      let basePlacements = placements;
      let lastSnappedDx = 0, lastSnappedDy = 0;

      // Build bounding sizes for selection (constant during drag)
      const selSizes = new Map<string, { w: number; h: number }>();
      for (const p of placements) {
        if (startPositions.has(p.id)) selSizes.set(p.id, { w: p.width, h: p.height });
      }

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        if (!moved) return;

        // Option+drag: duplicate selected placements (once per drag)
        if (ev.altKey && !duplicated) {
          duplicated = true;
          const clones: DesignPlacement[] = [];
          for (const p of placements) {
            if (startPositions.has(p.id)) {
              clones.push({ ...p, id: generateId(), timestamp: Date.now() });
            }
          }
          basePlacements = [...placements, ...clones];
        }

        // Compute bounding box of selection at prospective position
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [sid, start] of startPositions) {
          const sz = selSizes.get(sid);
          if (!sz) continue;
          minX = Math.min(minX, start.x + dx);
          minY = Math.min(minY, start.y + dy);
          maxX = Math.max(maxX, start.x + dx + sz.w);
          maxY = Math.max(maxY, start.y + dy + sz.h);
        }
        const selRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const { dx: snapDx, dy: snapDy, guides: newGuides } = computeSnap(selRect, basePlacements, new Set(startPositions.keys()), undefined, extraSnapRects);
        guides.value = newGuides;

        const snappedDx = dx + snapDx;
        const snappedDy = dy + snapDy;
        lastSnappedDx = snappedDx;
        lastSnappedDy = snappedDy;
        onChange(
          basePlacements.map((p) => {
            const start = startPositions.get(p.id);
            if (!start) return p;
            return { ...p, x: Math.max(0, start.x + snappedDx), y: Math.max(0, start.y + snappedDy) };
          }),
        );
        props.onDragMove?.(snappedDx, snappedDy);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        interaction = null;
        onInteractionChange?.(false);
        guides.value = [];
        props.onDragEnd?.(lastSnappedDx, lastSnappedDy, moved);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    // --- Resize handle ---
    const handleResizeMouseDown = (e: MouseEvent, id: string, dir: HandleDir) => {
      e.preventDefault();
      e.stopPropagation();

      const { onChange, onInteractionChange, extraSnapRects } = props;
      const comp = props.placements.find((p) => p.id === id);
      if (!comp) return;

      selectedIds.value = new Set([id]);
      interaction = "resize";
      onInteractionChange?.(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = comp.width;
      const startH = comp.height;
      const startLeft = comp.x;
      const startTop = comp.y;

      // Determine which edges are active for this resize direction
      const activeEdges = {
        left: dir.includes("w"),
        right: dir.includes("e"),
        top: dir.includes("n"),
        bottom: dir.includes("s"),
      };

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let nw = startW,
          nh = startH,
          nx = startLeft,
          ny = startTop;

        if (dir.includes("e")) nw = Math.max(MIN_SIZE, startW + dx);
        if (dir.includes("w")) {
          nw = Math.max(MIN_SIZE, startW - dx);
          nx = startLeft + startW - nw;
        }
        if (dir.includes("s")) nh = Math.max(MIN_SIZE, startH + dy);
        if (dir.includes("n")) {
          nh = Math.max(MIN_SIZE, startH - dy);
          ny = startTop + startH - nh;
        }

        // Smart-snap active edges to nearby elements
        const rect = { x: nx, y: ny, width: nw, height: nh };
        const { dx: snapDx, dy: snapDy, guides: newGuides } = computeSnap(rect, props.placements, new Set([id]), activeEdges, extraSnapRects);
        guides.value = newGuides;

        // Apply snap by adjusting the active edge
        if (snapDx !== 0) {
          if (activeEdges.right) nw += snapDx;
          else if (activeEdges.left) { nx += snapDx; nw -= snapDx; }
        }
        if (snapDy !== 0) {
          if (activeEdges.bottom) nh += snapDy;
          else if (activeEdges.top) { ny += snapDy; nh -= snapDy; }
        }

        onChange(props.placements.map((p) => (p.id === id ? { ...p, x: nx, y: ny, width: nw, height: nh } : p)));

        sizeIndicator.value = {
          x: ev.clientX + 12,
          y: ev.clientY + 12,
          text: `${Math.round(nw)} × ${Math.round(nh)}`,
        };
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        sizeIndicator.value = null;
        interaction = null;
        onInteractionChange?.(false);
        guides.value = [];
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    // --- Delete a single placement (animate out, then remove) ---
    const handleDelete = (id: string) => {
      interaction = null;
      exitingIds.value = new Set(exitingIds.value).add(id);
      const nextSelected = new Set(selectedIds.value);
      nextSelected.delete(id);
      selectedIds.value = nextSelected;
      originalSetTimeout(() => {
        props.onChange(props.placements.filter((p) => p.id !== id));
        const nextExiting = new Set(exitingIds.value);
        nextExiting.delete(id);
        exitingIds.value = nextExiting;
      }, 180);
    };

    // --- Double-click: edit text ---
    const handleDoubleClick = (id: string) => {
      const p = props.placements.find((pl) => pl.id === id);
      if (!p) return;
      editHadText = !!p.text;
      editingId.value = id;
      editExiting.value = false;
    };

    const dismissEdit = () => {
      if (!editingId.value) return;
      editExiting.value = true;
      originalSetTimeout(() => { editingId.value = null; editExiting.value = false; }, 150);
    };

    // Dismiss popup when overlay starts exiting
    watch(() => props.exiting, (exiting) => { if (exiting && editingId.value) dismissEdit(); });

    const submitEdit = (text: string) => {
      const id = editingId.value;
      if (!id) return;
      props.onChange(props.placements.map((p) => (p.id === id ? { ...p, text: text.trim() || undefined } : p)));
      dismissEdit();
    };

    const cornerHandles: HandleDir[] = ["nw", "ne", "se", "sw"];

    return () => {
      const { placements, isDarkMode, activeComponent, passthrough, exiting, wireframe, className: extraClassName, clearingPlacements } = props;
      const currentScrollY = scrollY.value;
      const arrowColor = wireframe ? "#f97316" : "#3c82f7";
      const edgeHandles: { dir: HandleDir; cls: string; arrow: JSX.Element }[] = [
        { dir: "n", cls: styles.edgeN, arrow: <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 0.5L1 4.5h6z" fill={arrowColor}/></svg> },
        { dir: "e", cls: styles.edgeE, arrow: <svg width="6" height="8" viewBox="0 0 6 8" fill="none"><path d="M5.5 4L1.5 1v6z" fill={arrowColor}/></svg> },
        { dir: "s", cls: styles.edgeS, arrow: <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 5.5L1 1.5h6z" fill={arrowColor}/></svg> },
        { dir: "w", cls: styles.edgeW, arrow: <svg width="6" height="8" viewBox="0 0 6 8" fill="none"><path d="M0.5 4L4.5 1v6z" fill={arrowColor}/></svg> },
      ];

      const editPopup = (() => {
        if (!editingId.value) return null;
        const ep = placements.find((p) => p.id === editingId.value);
        if (!ep) return null;
        const ey = ep.y - currentScrollY;
        const centerX = ep.x + ep.width / 2;
        const aboveY = ey - 8;
        const belowY = ey + ep.height + 8;
        const fitsAbove = aboveY > 200;
        const fitsBelow = belowY < window.innerHeight - 100;
        const popupLeft = Math.max(160, Math.min(window.innerWidth - 160, centerX));
        let popupStyle: CSSProperties | undefined;
        if (fitsAbove) {
          popupStyle = rs({ left: popupLeft, bottom: window.innerHeight - aboveY });
        } else if (fitsBelow) {
          popupStyle = rs({ left: popupLeft, top: belowY });
        } else {
          // Tall component: place popup at vertical center of viewport
          popupStyle = rs({ left: popupLeft, top: Math.max(80, window.innerHeight / 2 - 80) });
        }
        return (
          <AnnotationPopupCSS
            element={COMPONENT_MAP[ep.type]?.label || ep.type}
            placeholder={TEXT_PLACEHOLDERS[ep.type] || "Label or content text"}
            initialValue={ep.text ?? ""}
            submitLabel={editHadText ? "Save" : "Set"}
            onSubmit={submitEdit}
            onCancel={dismissEdit}
            onDelete={editHadText ? () => { submitEdit(""); } : undefined}
            isExiting={editExiting.value}
            lightMode={!isDarkMode}
            style={popupStyle}
          />
        );
      })();

      return (
        <>
          <div
            ref={overlayRef}
            class={`${styles.overlay} ${!isDarkMode ? styles.light : ""} ${activeComponent ? styles.placing : ""} ${passthrough ? styles.passthrough : ""} ${exiting ? styles.overlayExiting : ""} ${wireframe ? styles.wireframe : ""}${extraClassName ? ` ${extraClassName}` : ""}`}
            data-feedback-toolbar
            onMousedown={handleOverlayMouseDown}
          >
            {/* Placed components */}
            {placements.map((p) => {
              const isSelected = selectedIds.value.has(p.id);
              const label = COMPONENT_MAP[p.type]?.label || p.type;
              const screenY = p.y - currentScrollY;
              if (p.text) lastAnnotationText.set(p.id, p.text);

              return (
                <div
                  key={p.id}
                  data-design-placement={p.id}
                  class={`${styles.placement} ${isSelected ? styles.selected : ""} ${exitingIds.value.has(p.id) || clearingPlacements?.includes(p) ? styles.exiting : ""}`}
                  style={rs({ left: p.x, top: screenY, width: p.width, height: p.height, position: "fixed" })}
                  onMousedown={(e: MouseEvent) => handlePlacementMouseDown(e, p.id)}
                  onDblclick={() => handleDoubleClick(p.id)}
                >
                  <span class={styles.placementLabel}>{label}</span>
                  <span class={`${styles.placementAnnotation} ${p.text ? styles.annotationVisible : ""}`}>
                    {p.text || lastAnnotationText.get(p.id) || ""}
                  </span>
                  <div class={styles.placementContent}>
                    <Skeleton type={p.type} width={p.width} height={p.height} text={p.text} />
                  </div>

                  {/* Delete button */}
                  <div
                    class={styles.deleteButton}
                    onMousedown={(e: MouseEvent) => e.stopPropagation()}
                    onClick={() => handleDelete(p.id)}
                  >
                    ✕
                  </div>

                  {/* Corner resize handles */}
                  {cornerHandles.map((dir) => (
                    <div
                      key={dir}
                      class={`${styles.handle} ${styles[`handle${dir.charAt(0).toUpperCase()}${dir.slice(1)}` as keyof typeof styles]}`}
                      onMousedown={(e: MouseEvent) => handleResizeMouseDown(e, p.id, dir)}
                    />
                  ))}
                  {/* Edge resize bars */}
                  {edgeHandles.map(({ dir, cls, arrow }) => (
                    <div
                      key={dir}
                      class={`${styles.edgeHandle} ${cls}`}
                      onMousedown={(e: MouseEvent) => handleResizeMouseDown(e, p.id, dir)}
                    >
                      {arrow}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Text editing popup (uses annotation popup) */}
          {editPopup}

          {/* Draw box (drag-to-place preview) */}
          {drawBox.value && (
            <div
              class={styles.drawBox}
              style={rs({ left: drawBox.value.x, top: drawBox.value.y, width: drawBox.value.w, height: drawBox.value.h })}
              data-feedback-toolbar
            />
          )}

          {/* Select box */}
          {selectBox.value && (
            <div
              class={styles.selectBox}
              style={rs({ left: selectBox.value.x, top: selectBox.value.y, width: selectBox.value.w, height: selectBox.value.h })}
              data-feedback-toolbar
            />
          )}

          {/* Size indicator */}
          {sizeIndicator.value && (
            <div
              class={styles.sizeIndicator}
              style={rs({ left: sizeIndicator.value.x, top: sizeIndicator.value.y })}
              data-feedback-toolbar
            >
              {sizeIndicator.value.text}
            </div>
          )}

          {/* Smart guides */}
          {guides.value.map((g, i) => (
            <div
              key={`${g.axis}-${g.pos}-${i}`}
              class={styles.guideLine}
              style={rs(g.axis === "x"
                ? { position: "fixed", left: g.pos, top: 0, width: 1, bottom: 0 }
                : { position: "fixed", left: 0, top: g.pos - currentScrollY, right: 0, height: 1 })}
              data-feedback-toolbar
            />
          ))}
        </>
      );
    };
  },
});
