import { defineComponent, onBeforeUnmount, onMounted, onUpdated, ref, watch, type CSSProperties, type PropType } from "vue";
import { captureElement } from "@agentation/core/design-mode/section-detection";
import { AnnotationPopupCSS } from "../annotation-popup-css";
import type { DetectedSection, RearrangeState } from "@agentation/core/design-mode/types";
import styles from "@agentation/core/styles/design-mode/styles.module.scss";
import { originalSetTimeout } from "@agentation/core/utils/freeze-animations";
import { rs } from "../../utils/react-style";

// =============================================================================
// Rearrange Overlay — Click-to-capture, free drag, resize
// =============================================================================

const SECTION_COLOR = { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.5)", pill: "#3b82f6" };

type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MIN_SIZE = 24;
const MIN_CAPTURE_SIZE = 16;
const SNAP_THRESHOLD = 5;

type Guide = { axis: "x" | "y"; pos: number };

type SnapRect = { x: number; y: number; width: number; height: number };

function computeSectionSnap(
  rect: SnapRect,
  sections: DetectedSection[],
  excludeIds: Set<string>,
  extraRects?: SnapRect[],
): { dx: number; dy: number; guides: Guide[] } {
  let bestDx = Infinity;
  let bestDy = Infinity;

  const mL = rect.x, mR = rect.x + rect.width, mCx = rect.x + rect.width / 2;
  const mT = rect.y, mB = rect.y + rect.height, mCy = rect.y + rect.height / 2;

  // Build unified list of target rects (sections + extra rects from placements)
  const allTargets: SnapRect[] = [];
  for (const s of sections) {
    if (!excludeIds.has(s.id)) allTargets.push(s.currentRect);
  }
  if (extraRects) allTargets.push(...extraRects);

  for (const o of allTargets) {
    const oL = o.x, oR = o.x + o.width, oCx = o.x + o.width / 2;
    const oT = o.y, oB = o.y + o.height, oCy = o.y + o.height / 2;

    for (const from of [mL, mR, mCx]) {
      for (const to of [oL, oR, oCx]) {
        const d = to - from;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDx)) bestDx = d;
      }
    }
    for (const from of [mT, mB, mCy]) {
      for (const to of [oT, oB, oCy]) {
        const d = to - from;
        if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDy)) bestDy = d;
      }
    }
  }

  const dx = Math.abs(bestDx) < SNAP_THRESHOLD ? bestDx : 0;
  const dy = Math.abs(bestDy) < SNAP_THRESHOLD ? bestDy : 0;

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

const SKIP_TAGS = new Set(["script", "style", "noscript", "link", "meta", "br", "hr"]);

/**
 * Pick a reasonable capture target from any element. Walk up only to skip
 * tiny inline elements (span, em, strong, etc.) — otherwise take whatever
 * was clicked, same as normal agentation annotations.
 */
function pickTarget(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.closest("[data-feedback-toolbar]")) return null;
    if (SKIP_TAGS.has(current.tagName.toLowerCase())) {
      current = current.parentElement;
      continue;
    }
    const rect = current.getBoundingClientRect();
    if (rect.width >= MIN_CAPTURE_SIZE && rect.height >= MIN_CAPTURE_SIZE) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export type RearrangeOverlayProps = {
  rearrangeState: RearrangeState;
  onChange: (state: RearrangeState) => void;
  isDarkMode: boolean;
  exiting?: boolean;
  className?: string;
  blankCanvas?: boolean;
  extraSnapRects?: SnapRect[];
  onSelectionChange?: (selectedIds: Set<string>, isShift: boolean) => void;
  deselectSignal?: number;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number, committed: boolean) => void;
  clearing?: boolean;
};

type Rect = { x: number; y: number; width: number; height: number };
type ExitingConnector = { orig: Rect; target: Rect; isFixed?: boolean };

const hasChanged = (s: DetectedSection): boolean => {
  const o = s.originalRect, c = s.currentRect;
  return Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1 || Math.abs(o.width - c.width) > 1 || Math.abs(o.height - c.height) > 1;
};

const isMoved = (s: DetectedSection): boolean => {
  const o = s.originalRect, c = s.currentRect;
  return Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1;
};

const isResized = (s: DetectedSection): boolean => {
  const o = s.originalRect, c = s.currentRect;
  return Math.abs(o.width - c.width) > 1 || Math.abs(o.height - c.height) > 1;
};

// Handlers read props when an interaction starts, the same values the React
// handler closures captured in the render that attached them.
export const RearrangeOverlay = defineComponent({
  name: "RearrangeOverlay",
  props: {
    rearrangeState: { type: Object as PropType<RearrangeState>, required: true },
    onChange: { type: Function as PropType<(state: RearrangeState) => void>, required: true },
    isDarkMode: Boolean,
    exiting: Boolean,
    className: String,
    blankCanvas: Boolean,
    extraSnapRects: Array as PropType<SnapRect[]>,
    onSelectionChange: Function as PropType<(selectedIds: Set<string>, isShift: boolean) => void>,
    deselectSignal: Number,
    onDragMove: Function as PropType<(dx: number, dy: number) => void>,
    onDragEnd: Function as PropType<(dx: number, dy: number, committed: boolean) => void>,
    clearing: Boolean,
  },
  setup(props) {
    const selectedIds = ref<Set<string>>(new Set());

    watch(() => props.clearing, (clearing) => { if (clearing) selectedIds.value = new Set(); }, { immediate: true });

    // Clear selection when the other overlay signals deselect
    watch(() => props.deselectSignal, () => { selectedIds.value = new Set(); });

    // --- Double-click annotation editing ---
    const editingId = ref<string | null>(null);
    const editExiting = ref(false);
    let editHadNote = false;

    const handleDoubleClick = (id: string) => {
      const s = props.rearrangeState.sections.find((sec) => sec.id === id);
      if (!s) return;
      editHadNote = !!s.note;
      editingId.value = id;
      editExiting.value = false;
    };

    const dismissEdit = () => {
      if (!editingId.value) return;
      editExiting.value = true;
      originalSetTimeout(() => { editingId.value = null; editExiting.value = false; }, 150);
    };

    const submitEdit = (text: string) => {
      const id = editingId.value;
      if (!id) return;
      const { rearrangeState } = props;
      props.onChange({
        ...rearrangeState,
        sections: rearrangeState.sections.map((s) => (s.id === id ? { ...s, note: text.trim() || undefined } : s)),
      });
      dismissEdit();
    };

    // Dismiss popup when overlay exits
    watch(() => props.exiting, (exiting) => { if (exiting && editingId.value) dismissEdit(); });

    const exitingIds = ref<Set<string>>(new Set());
    const lastNoteText = new Map<string, string>();
    const hoverHighlight = ref<{ x: number; y: number; w: number; h: number } | null>(null);
    const sizeIndicator = ref<{ x: number; y: number; text: string } | null>(null);
    const snapGuides = ref<Guide[]>([]);
    const scrollY = ref(0);
    let interaction: string | null = null;
    // Track which sections have already appeared as ghosts (skip ghostEnter replay)
    const seenGhostIds = new Set<string>();
    // Track which action (move/resize) happened first per section, for badge ordering
    const firstAction = new Map<string, "move" | "resize">();
    // Live drag/resize positions for connector lines during interaction
    const dragPositions = ref<Map<string, Rect>>(new Map());
    // Exiting connectors: sections that returned to original position, animating out
    const exitingConnectors = ref<Map<string, ExitingConnector>>(new Map());
    let prevChangedIds = new Set<string>();
    // Track last known currentRect for each changed section (for exit animation)
    const lastChangedRects = new Map<string, { currentRect: Rect; originalRect: Rect; isFixed?: boolean }>();

    // Clear selection when blank canvas is toggled on
    watch(() => props.blankCanvas, (blank) => { if (blank) selectedIds.value = new Set(); }, { immediate: true });

    // Delay showing outlines on mount if sections are already moved (elements animate first)
    const outlinesReady = ref(!props.rearrangeState.sections.some(hasChanged));
    let outlinesTimer: ReturnType<typeof originalSetTimeout> | undefined;
    onMounted(() => {
      if (!outlinesReady.value) outlinesTimer = originalSetTimeout(() => { outlinesReady.value = true; }, 380);
    });

    // Track captured selectors for dedup
    let capturedSelectors = new Set<string>();
    watch(
      () => props.rearrangeState.sections,
      (sections) => { capturedSelectors = new Set(sections.map((s) => s.selector)); },
      { immediate: true },
    );

    const overlayRef = ref<HTMLDivElement | null>(null);
    // Resolve at interaction time; first-drag listeners predate the shadow ref.
    const getOverlayRoot = () =>
      (overlayRef.value?.getRootNode() as Document | ShadowRoot | undefined) ?? document;

    // --- Keep scrollY in sync so outlines track the page ---
    const onScroll = () => { scrollY.value = window.scrollY; };

    // --- Hover: highlight whatever element is under cursor ---
    const handleMouseMove = (e: MouseEvent) => {
      if (interaction) { hoverHighlight.value = null; return; }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el) { hoverHighlight.value = null; return; }
      if (el.closest("[data-feedback-toolbar]")) { hoverHighlight.value = null; return; }
      if (el.closest("[data-design-placement]")) { hoverHighlight.value = null; return; }
      if (el.closest("[data-annotation-popup]")) { hoverHighlight.value = null; return; }

      const target = pickTarget(el);
      if (!target) { hoverHighlight.value = null; return; }

      // Skip already-captured elements (exact match or target is parent of captured)
      for (const sel of capturedSelectors) {
        try {
          const captured = document.querySelector(sel);
          if (captured && (captured === target || target.contains(captured))) {
            hoverHighlight.value = null;
            return;
          }
        } catch { /* invalid selector */ }
      }

      const rect = target.getBoundingClientRect();
      hoverHighlight.value = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };

    // --- Mousedown to capture new elements (+ immediate drag) ---
    const handleMouseDown = (e: MouseEvent) => {
      if (interaction) return;
      if (e.button !== 0) return;
      const el = (e.composedPath()[0] ?? e.target) as HTMLElement;
      if (!el || el.closest("[data-feedback-toolbar]")) return;
      if (el.closest("[data-design-placement]")) return;
      if (el.closest("[data-annotation-popup]")) return;

      const { rearrangeState, onChange, extraSnapRects } = props;
      const { sections } = rearrangeState;
      const target = pickTarget(el);
      let alreadyCaptured = false;
      if (target) {
        for (const sel of capturedSelectors) {
          try {
            const captured = document.querySelector(sel);
            if (captured && (captured === target || target.contains(captured))) {
              alreadyCaptured = true;
              break;
            }
          } catch { /* invalid selector */ }
        }
      }

      const isShift = !!(e.shiftKey || e.metaKey || e.ctrlKey);
      if (target && !alreadyCaptured) {
        e.preventDefault();
        e.stopPropagation();
        const section = captureElement(target);
        const newSections = [...sections, section];
        const newOrder = [...rearrangeState.originalOrder, section.id];
        onChange({
          ...rearrangeState,
          sections: newSections,
          originalOrder: newOrder,
        });
        const newIds = new Set([section.id]);
        selectedIds.value = newIds;
        props.onSelectionChange?.(newIds, isShift);
        hoverHighlight.value = null;

        // Start drag tracking immediately
        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = { x: section.currentRect.x, y: section.currentRect.y };
        let moved = false;
        let lastDx = 0, lastDy = 0;
        interaction = "move";

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;
          if (!moved) return;

          const rect = { x: startPos.x + dx, y: startPos.y + dy, width: section.currentRect.width, height: section.currentRect.height };
          const snap = computeSectionSnap(rect, newSections, new Set([section.id]), extraSnapRects);
          snapGuides.value = snap.guides;
          const snappedDx = dx + snap.dx;
          const snappedDy = dy + snap.dy;
          lastDx = snappedDx;
          lastDy = snappedDy;

          // Ghost mode: only move outline (ghost preview), not the page element
          const outlineEl = getOverlayRoot().querySelector(`[data-rearrange-section="${section.id}"]`) as HTMLElement | null;
          if (outlineEl) outlineEl.style.transform = `translate(${snappedDx}px, ${snappedDy}px)`;
          // Update live drag position for connector lines
          dragPositions.value = new Map([[section.id, { x: startPos.x + snappedDx, y: startPos.y + snappedDy, width: section.currentRect.width, height: section.currentRect.height }]]);
          props.onDragMove?.(snappedDx, snappedDy);
        };

        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          interaction = null;
          snapGuides.value = [];
          dragPositions.value = new Map();
          const outlineEl = getOverlayRoot().querySelector(`[data-rearrange-section="${section.id}"]`) as HTMLElement | null;
          if (outlineEl) outlineEl.style.transform = "";
          if (moved) {
            onChange({
              ...rearrangeState,
              sections: newSections.map((s) =>
                s.id === section.id
                  ? { ...s, currentRect: { ...s.currentRect, x: Math.max(0, startPos.x + lastDx), y: Math.max(0, startPos.y + lastDy) } }
                  : s,
              ),
              originalOrder: newOrder,
            });
          }
          props.onDragEnd?.(lastDx, lastDy, moved);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      } else if (alreadyCaptured && target) {
        e.preventDefault();
        // Clicked directly on a captured element's page node — select that section
        for (const s of sections) {
          try {
            const captured = document.querySelector(s.selector);
            if (captured && captured === target) {
              const newIds = new Set([s.id]);
              selectedIds.value = newIds;
              props.onSelectionChange?.(newIds, isShift);
              return;
            }
          } catch { /* invalid selector */ }
        }
        if (!isShift) {
          selectedIds.value = new Set();
          props.onSelectionChange?.(new Set(), false);
        }
      } else {
        if (!isShift) {
          selectedIds.value = new Set();
          props.onSelectionChange?.(new Set(), false);
        }
      }
    };

    // --- Keyboard: delete, nudge, escape ---
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = (e.composedPath()[0] || e.target) as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      const selected = selectedIds.value;
      const { rearrangeState, onChange } = props;

      if ((e.key === "Backspace" || e.key === "Delete") && selected.size > 0) {
        e.preventDefault();
        const idsToDelete = new Set(selected);
        const nextExiting = new Set(exitingIds.value);
        for (const id of idsToDelete) nextExiting.add(id);
        exitingIds.value = nextExiting;
        selectedIds.value = new Set();
        originalSetTimeout(() => {
          const state = props.rearrangeState;
          props.onChange({
            ...state,
            sections: state.sections.filter((s) => !idsToDelete.has(s.id)),
            originalOrder: state.originalOrder.filter((id) => !idsToDelete.has(id)),
          });
          const after = new Set(exitingIds.value);
          for (const id of idsToDelete) after.delete(id);
          exitingIds.value = after;
        }, 180);
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selected.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        onChange({
          ...rearrangeState,
          sections: rearrangeState.sections.map((s) =>
            selected.has(s.id)
              ? { ...s, currentRect: { ...s.currentRect, x: Math.max(0, s.currentRect.x + dx), y: Math.max(0, s.currentRect.y + dy) } }
              : s,
          ),
        });
        return;
      }

      if (e.key === "Escape" && selected.size > 0) {
        selectedIds.value = new Set();
      }
    };

    let prevUserSelect = "";
    onMounted(() => {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      document.addEventListener("mousemove", handleMouseMove, { passive: true });
      // --- Prevent text selection while rearrange mode is active ---
      prevUserSelect = document.body.style.userSelect;
      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";
      document.addEventListener("mousedown", handleMouseDown, true);
      document.addEventListener("keydown", handleKeyDown);
    });
    onBeforeUnmount(() => {
      clearTimeout(outlinesTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousemove", handleMouseMove);
      document.body.style.webkitUserSelect = prevUserSelect;
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    });

    // --- Click outline: select + drag ---
    const handleOutlineMouseDown = (e: MouseEvent, id: string) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.handle}`) || target.closest(`.${styles.deleteButton}`)) return;
      e.preventDefault();
      e.stopPropagation();

      const { rearrangeState, onChange, extraSnapRects } = props;
      const { sections } = rearrangeState;
      const selected = selectedIds.value;

      let newSelected: Set<string>;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
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
      if (changed) props.onSelectionChange?.(newSelected, !!(e.shiftKey || e.metaKey || e.ctrlKey));

      const startX = e.clientX;
      const startY = e.clientY;
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const s of sections) {
        if (newSelected.has(s.id)) {
          startPositions.set(s.id, { x: s.currentRect.x, y: s.currentRect.y });
        }
      }

      interaction = "move";
      let moved = false;
      let lastDx = 0, lastDy = 0;

      // Cache outline divs for direct updates during drag (no re-renders)
      // Ghost mode: only outlines move, page elements stay put
      const dragEls = new Map<string, { outlineEl: HTMLElement | null; curW: number; curH: number }>();
      for (const s of sections) {
        if (newSelected.has(s.id)) {
          const outlineEl = getOverlayRoot().querySelector(`[data-rearrange-section="${s.id}"]`) as HTMLElement | null;
          dragEls.set(s.id, { outlineEl, curW: s.currentRect.width, curH: s.currentRect.height });
        }
      }

      const onMove = (ev: MouseEvent) => {
        const rawDx = ev.clientX - startX;
        const rawDy = ev.clientY - startY;
        if (rawDx === 0 && rawDy === 0) return;
        moved = true;

        // Compute bounding box of all selected sections at current drag position
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [sid, { curW, curH }] of dragEls) {
          const start = startPositions.get(sid);
          if (!start) continue;
          const cx = start.x + rawDx, cy = start.y + rawDy;
          minX = Math.min(minX, cx); minY = Math.min(minY, cy);
          maxX = Math.max(maxX, cx + curW); maxY = Math.max(maxY, cy + curH);
        }
        const snap = computeSectionSnap(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          sections,
          newSelected,
          extraSnapRects,
        );
        const dx = rawDx + snap.dx;
        const dy = rawDy + snap.dy;
        lastDx = dx;
        lastDy = dy;
        snapGuides.value = snap.guides;

        // Ghost mode: only move outline divs, page elements stay put
        for (const [, { outlineEl }] of dragEls) {
          if (outlineEl) outlineEl.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        // Update live drag positions for connector lines + ghost clones
        const livePos = new Map<string, Rect>();
        for (const [sid, { curW, curH }] of dragEls) {
          const start = startPositions.get(sid);
          if (start) livePos.set(sid, { x: Math.max(0, start.x + dx), y: Math.max(0, start.y + dy), width: curW, height: curH });
        }
        dragPositions.value = livePos;
        props.onDragMove?.(dx, dy);
      };

      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        interaction = null;
        snapGuides.value = [];
        dragPositions.value = new Map();

        // Clear outline transforms — the state update sets the correct left/top
        for (const [, { outlineEl }] of dragEls) {
          if (outlineEl) outlineEl.style.transform = "";
        }

        if (moved) {
          const totalDx = ev.clientX - startX;
          const totalDy = ev.clientY - startY;
          if (Math.abs(totalDx) < 5 && Math.abs(totalDy) < 5) {
            // Snap back — revert to pre-drag position
            onChange({
              ...rearrangeState,
              sections: sections.map((s) => {
                const start = startPositions.get(s.id);
                if (!start) return s;
                return { ...s, currentRect: { ...s.currentRect, x: start.x, y: start.y } };
              }),
            });
          } else {
            // Commit final ghost position
            onChange({
              ...rearrangeState,
              sections: sections.map((s) => {
                const start = startPositions.get(s.id);
                if (!start) return s;
                return { ...s, currentRect: { ...s.currentRect, x: Math.max(0, start.x + lastDx), y: Math.max(0, start.y + lastDy) } };
              }),
            });
            props.onDragEnd?.(lastDx, lastDy, true);
            return;
          }
        }
        props.onDragEnd?.(0, 0, false);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    // --- Resize ---
    const handleResizeMouseDown = (e: MouseEvent, id: string, dir: HandleDir) => {
      e.preventDefault();
      e.stopPropagation();
      const { rearrangeState, onChange } = props;
      const { sections } = rearrangeState;
      const section = sections.find((s) => s.id === id);
      if (!section) return;
      const startScrollY = scrollY.value;

      selectedIds.value = new Set([id]);
      interaction = "resize";

      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = { ...section.currentRect };
      const aspectRatio = startRect.width / startRect.height;
      let lastRect = { ...startRect };

      // Cache outline for direct updates — ghost mode, no page element transforms
      const resizeOutlineEl = getOverlayRoot().querySelector(`[data-rearrange-section="${id}"]`) as HTMLElement | null;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let nx = startRect.x, ny = startRect.y, nw = startRect.width, nh = startRect.height;

        if (dir.includes("e")) nw = Math.max(MIN_SIZE, startRect.width + dx);
        if (dir.includes("w")) { nw = Math.max(MIN_SIZE, startRect.width - dx); nx = startRect.x + startRect.width - nw; }
        if (dir.includes("s")) nh = Math.max(MIN_SIZE, startRect.height + dy);
        if (dir.includes("n")) { nh = Math.max(MIN_SIZE, startRect.height - dy); ny = startRect.y + startRect.height - nh; }

        // Shift = constrain aspect ratio
        if (ev.shiftKey) {
          const isCorner = dir.length === 2;
          if (isCorner) {
            const wDelta = Math.abs(nw - startRect.width);
            const hDelta = Math.abs(nh - startRect.height);
            if (wDelta > hDelta) {
              nh = nw / aspectRatio;
            } else {
              nw = nh * aspectRatio;
            }
            if (dir.includes("w")) nx = startRect.x + startRect.width - nw;
            if (dir.includes("n")) ny = startRect.y + startRect.height - nh;
          } else {
            if (dir === "e" || dir === "w") {
              nh = nw / aspectRatio;
            } else {
              nw = nh * aspectRatio;
            }
            if (dir === "w") nx = startRect.x + startRect.width - nw;
            if (dir === "n") ny = startRect.y + startRect.height - nh;
          }
        }

        lastRect = { x: nx, y: ny, width: nw, height: nh };

        // Ghost mode: only update outline, not page element
        if (resizeOutlineEl) {
          resizeOutlineEl.style.left = `${nx}px`;
          resizeOutlineEl.style.top = `${ny - startScrollY}px`;
          resizeOutlineEl.style.width = `${nw}px`;
          resizeOutlineEl.style.height = `${nh}px`;
        }
        sizeIndicator.value = { x: ev.clientX + 12, y: ev.clientY + 12, text: `${Math.round(nw)} × ${Math.round(nh)}` };
        dragPositions.value = new Map([[id, lastRect]]);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        sizeIndicator.value = null;
        interaction = null;
        dragPositions.value = new Map();
        // Commit final size — element already at right spot from direct DOM
        onChange({
          ...rearrangeState,
          sections: sections.map((s) => (s.id === id ? { ...s, currentRect: lastRect } : s)),
        });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const handleDelete = (id: string) => {
      exitingIds.value = new Set(exitingIds.value).add(id);
      const nextSelected = new Set(selectedIds.value);
      nextSelected.delete(id);
      selectedIds.value = nextSelected;
      originalSetTimeout(() => {
        const state = props.rearrangeState;
        props.onChange({
          ...state,
          sections: state.sections.filter((s) => s.id !== id),
          originalOrder: state.originalOrder.filter((oid) => oid !== id),
        });
        const nextExiting = new Set(exitingIds.value);
        nextExiting.delete(id);
        exitingIds.value = nextExiting;
      }, 180);
    };

    // Detect sections that just returned to original (connector exit animation).
    // React runs this as an effect keyed on the changed IDs computed in render;
    // here the render records them and the post-render hook compares.
    let renderedChangedIds = new Set<string>();
    let renderedChangedKey = "";
    let effectKey: string | null = null;
    let effectSections: DetectedSection[] | null = null;
    let connectorTimer: ReturnType<typeof originalSetTimeout> | undefined;
    const afterRender = () => {
      const sections = props.rearrangeState.sections;
      if (renderedChangedKey === effectKey && sections === effectSections) return;
      effectKey = renderedChangedKey;
      effectSections = sections;
      clearTimeout(connectorTimer);
      const currentChangedIds = renderedChangedIds;
      const prev = prevChangedIds;
      prevChangedIds = currentChangedIds;
      const exiting = new Map<string, ExitingConnector>();
      for (const id of prev) {
        if (!currentChangedIds.has(id)) {
          // Skip if section was deleted — exitingIds connector fade handles that
          if (!sections.some((s) => s.id === id)) continue;
          // Use the last known position before it snapped back
          const last = lastChangedRects.get(id);
          if (last) {
            exiting.set(id, { orig: last.originalRect, target: last.currentRect, isFixed: last.isFixed });
            lastChangedRects.delete(id);
          }
        }
      }
      if (exiting.size > 0) {
        const next = new Map(exitingConnectors.value);
        for (const [id, data] of exiting) next.set(id, data);
        exitingConnectors.value = next;
        connectorTimer = originalSetTimeout(() => {
          const after = new Map(exitingConnectors.value);
          for (const id of exiting.keys()) after.delete(id);
          exitingConnectors.value = after;
        }, 250);
      }
    };
    onMounted(afterRender);
    onUpdated(afterRender);
    onBeforeUnmount(() => clearTimeout(connectorTimer));

    return () => {
      const { rearrangeState, isDarkMode, exiting, className: extraClassName, blankCanvas, clearing } = props;
      const { sections } = rearrangeState;
      const selected = selectedIds.value;
      const currentScrollY = scrollY.value;
      const ready = outlinesReady.value;

      // Track first action per section for badge ordering
      for (const s of sections) {
        if (!firstAction.has(s.id)) {
          if (isMoved(s)) firstAction.set(s.id, "move");
          else if (isResized(s)) firstAction.set(s.id, "resize");
        }
      }
      // Clean up deleted sections
      for (const id of firstAction.keys()) {
        if (!sections.some((s) => s.id === id)) firstAction.delete(id);
      }

      // Filter to visible sections (DOM element still exists on page)
      const visibleSections = sections.filter((s) => { try {
        if (exitingIds.value.has(s.id)) return true; // keep visible during exit animation
        if (selected.has(s.id)) return true;
        const el = document.querySelector(s.selector);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const expected = s.originalRect;
        const sizeDiff = Math.abs(rect.width - expected.width) + Math.abs(rect.height - expected.height);
        return sizeDiff < 200;
      } catch { return false; } });

      // Separate changed vs unchanged sections
      const changedSections = visibleSections.filter((s) => hasChanged(s));
      const unchangedSections = visibleSections.filter((s) => !hasChanged(s));

      // Clean up seenGhostIds for sections no longer changed (so animation replays if they become ghosts again)
      const currentChangedIds = new Set(changedSections.map((s) => s.id));
      for (const id of seenGhostIds) {
        if (!currentChangedIds.has(id)) seenGhostIds.delete(id);
      }
      renderedChangedIds = currentChangedIds;
      renderedChangedKey = [...currentChangedIds].sort().join(",");
      // Keep last known positions of changed sections up to date
      for (const s of changedSections) {
        lastChangedRects.set(s.id, { currentRect: s.currentRect, originalRect: s.originalRect, isFixed: s.isFixed });
      }

      const noteText = (section: DetectedSection) => {
        if (section.note) lastNoteText.set(section.id, section.note);
        return section.note || lastNoteText.get(section.id) || "";
      };
      const handles = (section: DetectedSection) =>
        HANDLES.map((dir) => (
          <div
            key={dir}
            class={`${styles.handle} ${styles[`handle${dir.charAt(0).toUpperCase()}${dir.slice(1)}` as keyof typeof styles]}`}
            onMousedown={(e: MouseEvent) => handleResizeMouseDown(e, section.id, dir)}
          />
        ));

      const connectors = (() => {
        if (blankCanvas) return null;
        // Build list of sections that need connectors: committed changes + live drags
        const connectorSections: { id: string; orig: Rect; target: Rect; isFixed?: boolean; isSelected: boolean; isExiting?: boolean }[] = [];
        for (const s of changedSections) {
          const livePos = dragPositions.value.get(s.id);
          connectorSections.push({ id: s.id, orig: s.originalRect, target: livePos || s.currentRect, isFixed: s.isFixed, isSelected: selected.has(s.id), isExiting: exitingIds.value.has(s.id) });
        }
        // Also add sections being dragged that haven't changed yet (first drag)
        for (const [id, pos] of dragPositions.value) {
          if (!connectorSections.some((c) => c.id === id)) {
            const s = sections.find((sec) => sec.id === id);
            if (s) connectorSections.push({ id, orig: s.originalRect, target: pos, isFixed: s.isFixed, isSelected: selected.has(id) });
          }
        }
        // Add exiting connectors (sections that returned to original)
        for (const [id, data] of exitingConnectors.value) {
          if (!connectorSections.some((c) => c.id === id)) {
            connectorSections.push({ id, orig: data.orig, target: data.target, isFixed: data.isFixed, isSelected: false, isExiting: true });
          }
        }

        if (connectorSections.length === 0) return null;

        return (
          <svg class={`${styles.connectorSvg} ${clearing || exiting ? styles.connectorExiting : ""}`}>
            {connectorSections.map(({ id, orig, target, isFixed, isSelected, isExiting }) => {
              const ox = orig.x + orig.width / 2;
              const oy = (isFixed ? orig.y : orig.y - currentScrollY) + orig.height / 2;
              const cx = target.x + target.width / 2;
              const cy = (isFixed ? target.y : target.y - currentScrollY) + target.height / 2;

              const ddx = cx - ox;
              const ddy = cy - oy;
              const dist = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dist < 2) return null;

              // Scale dots down as they approach each other
              const proximityScale = Math.min(1, dist / 40);
              const perpOffset = Math.min(dist * 0.3, 60);
              const nx = dist > 0 ? -ddy / dist : 0;
              const ny = dist > 0 ? ddx / dist : 0;
              const cpx = (ox + cx) / 2 + nx * perpOffset;
              const cpy = (oy + cy) / 2 + ny * perpOffset;
              const isDragging = dragPositions.value.has(id);
              const baseOpacity = isDragging || isSelected ? 1 : 0.4;
              const dotBaseOpacity = isDragging || isSelected ? 1 : 0.5;

              return (
                <g key={`conn-${id}`} class={isExiting ? styles.connectorExiting : ""}>
                  <path
                    class={styles.connectorLine}
                    d={`M ${ox} ${oy} Q ${cpx} ${cpy} ${cx} ${cy}`}
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.45)"
                    stroke-width="1.5"
                    opacity={baseOpacity * proximityScale}
                  />
                  {/* Endpoint circles */}
                  <circle class={styles.connectorDot} cx={ox} cy={oy} r={4 * proximityScale} fill="rgba(59, 130, 246, 0.8)" stroke="#fff" stroke-width="1.5" opacity={dotBaseOpacity * proximityScale} filter="url(#connDotShadow)" />
                  <circle class={styles.connectorDot} cx={cx} cy={cy} r={4 * proximityScale} fill="rgba(59, 130, 246, 0.8)" stroke="#fff" stroke-width="1.5" opacity={dotBaseOpacity * proximityScale} filter="url(#connDotShadow)" />
                </g>
              );
            })}
            <defs>
              <filter id="connDotShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0.5" stdDeviation="1" flood-opacity="0.15" />
              </filter>
            </defs>
          </svg>
        );
      })();

      const notePopup = (() => {
        if (!editingId.value) return null;
        const es = sections.find((s) => s.id === editingId.value);
        if (!es) return null;
        const rect = es.currentRect;
        const screenY = es.isFixed ? rect.y : rect.y - currentScrollY;
        const centerX = rect.x + rect.width / 2;
        const aboveY = screenY - 8;
        const belowY = screenY + rect.height + 8;
        const fitsAbove = aboveY > 200;
        const fitsBelow = belowY < window.innerHeight - 100;
        const popupLeft = Math.max(160, Math.min(window.innerWidth - 160, centerX));
        let popupStyle: CSSProperties | undefined;
        if (fitsAbove) {
          popupStyle = rs({ left: popupLeft, bottom: window.innerHeight - aboveY });
        } else if (fitsBelow) {
          popupStyle = rs({ left: popupLeft, top: belowY });
        } else {
          popupStyle = rs({ left: popupLeft, top: Math.max(80, window.innerHeight / 2 - 80) });
        }
        return (
          <AnnotationPopupCSS
            element={es.label}
            placeholder="Add a note about this section"
            initialValue={es.note ?? ""}
            submitLabel={editHadNote ? "Save" : "Set"}
            onSubmit={submitEdit}
            onCancel={dismissEdit}
            onDelete={editHadNote ? () => { submitEdit(""); } : undefined}
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
            class={`${styles.rearrangeOverlay} ${!isDarkMode ? styles.light : ""} ${exiting ? styles.overlayExiting : ""}${extraClassName ? ` ${extraClassName}` : ""}`}
            data-feedback-toolbar
          >
            {/* Hover highlight */}
            {hoverHighlight.value && (
              <div
                class={styles.hoverHighlight}
                style={rs({ left: hoverHighlight.value.x, top: hoverHighlight.value.y, width: hoverHighlight.value.w, height: hoverHighlight.value.h })}
              />
            )}

            {/* Unchanged sections — render at currentRect (same as originalRect) */}
            {unchangedSections.map((section) => {
              const rect = section.currentRect;
              const screenY = section.isFixed ? rect.y : rect.y - currentScrollY;
              const color = SECTION_COLOR;
              const isSelected = selected.has(section.id);

              return (
                <div
                  key={section.id}
                  data-rearrange-section={section.id}
                  class={`${styles.sectionOutline} ${isSelected ? styles.selected : ""} ${clearing || exiting || exitingIds.value.has(section.id) ? styles.exiting : ""}`}
                  style={rs({ left: rect.x, top: screenY, width: rect.width, height: rect.height, borderColor: color.border, backgroundColor: color.bg, ...(ready ? {} : { opacity: 0, animation: "none", transition: "none" }) })}
                  onMousedown={(e: MouseEvent) => handleOutlineMouseDown(e, section.id)}
                  onDblclick={() => handleDoubleClick(section.id)}
                >
                  <span class={styles.sectionLabel} style={{ backgroundColor: color.pill }}>
                    {section.label}
                  </span>
                  <span class={`${styles.sectionAnnotation} ${section.note ? styles.annotationVisible : ""}`}>{noteText(section)}</span>
                  <span class={styles.sectionDimensions}>
                    {Math.round(rect.width)} &times; {Math.round(rect.height)}
                  </span>
                  <div
                    class={styles.deleteButton}
                    onMousedown={(e: MouseEvent) => e.stopPropagation()}
                    onClick={() => handleDelete(section.id)}
                  >
                    ✕
                  </div>
                  {handles(section)}
                </div>
              );
            })}

            {/* No original outlines — connector line is sufficient */}

            {/* Changed sections — ghost outlines at currentRect (interactive) */}
            {changedSections.map((section) => {
              const rect = section.currentRect;
              const screenY = section.isFixed ? rect.y : rect.y - currentScrollY;
              const isSelected = selected.has(section.id);
              const moved = isMoved(section);
              const resized = isResized(section);
              const settled = !isSelected;

              if (blankCanvas && settled) return null;

              // Only animate ghostEnter the first time a section appears as a ghost
              const isNewGhost = !seenGhostIds.has(section.id);
              if (isNewGhost) seenGhostIds.add(section.id);

              const first = firstAction.get(section.id);
              const badge = moved && resized
                ? (() => {
                    const [a, b] = first === "resize" ? ["Resize", "Move"] : ["Move", "Resize"];
                    return <>Suggested {a} <span class={styles.ghostBadgeExtra}>&amp; {b}</span></>;
                  })()
                : `Suggested ${resized ? "Resize" : "Move"}`;

              return (
                <div
                  key={section.id}
                  data-rearrange-section={section.id}
                  class={`${styles.ghostOutline} ${isSelected ? styles.selected : ""} ${clearing || exiting || exitingIds.value.has(section.id) ? styles.exiting : ""}`}
                  style={rs({ left: rect.x, top: screenY, width: rect.width, height: rect.height, ...(ready ? {} : { opacity: 0, animation: "none", transition: "none" }), ...(!isNewGhost ? { animation: "none" } : {}) })}
                  onMousedown={(e: MouseEvent) => handleOutlineMouseDown(e, section.id)}
                  onDblclick={() => handleDoubleClick(section.id)}
                >
                  <span class={styles.sectionLabel} style={{ backgroundColor: SECTION_COLOR.pill }}>
                    {section.label}
                  </span>
                  <span class={`${styles.sectionAnnotation} ${section.note ? styles.annotationVisible : ""}`}>{noteText(section)}</span>
                  <span class={styles.sectionDimensions}>
                    {Math.round(rect.width)} &times; {Math.round(rect.height)}
                  </span>
                  <div
                    class={styles.deleteButton}
                    onMousedown={(e: MouseEvent) => e.stopPropagation()}
                    onClick={() => handleDelete(section.id)}
                  >
                    ✕
                  </div>
                  {handles(section)}
                  <span class={styles.ghostBadge}>{badge}</span>
                </div>
              );
            })}
          </div>

          {/* Annotation connector lines — SVG from original to ghost/drag position */}
          {connectors}

          {/* Note editing popup */}
          {notePopup}

          {sizeIndicator.value && (
            <div class={styles.sizeIndicator} style={rs({ left: sizeIndicator.value.x, top: sizeIndicator.value.y })} data-feedback-toolbar>
              {sizeIndicator.value.text}
            </div>
          )}

          {/* Snap alignment guides */}
          {snapGuides.value.map((g, i) => (
            <div
              key={`${g.axis}-${g.pos}-${i}`}
              class={styles.guideLine}
              style={rs(
                g.axis === "x"
                  ? { position: "fixed", left: g.pos, top: 0, width: 1, height: "100vh" }
                  : { position: "fixed", left: 0, top: g.pos - currentScrollY, width: "100vw", height: 1 },
              )}
            />
          ))}
        </>
      );
    };
  },
});
