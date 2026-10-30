import { defineComponent, ref, watch, type PropType, type Ref } from "vue";
import { COMPONENT_REGISTRY, type ComponentType } from "@core/components/design-mode/types";
import { originalRequestAnimationFrame, originalSetTimeout } from "@core/utils/freeze-animations";
import styles from "@core/components/design-mode/styles.module.scss";
import { usePanelPresence } from "../../composables/use-panel-presence";
import { rs } from "../../utils/react-style";

function scrollFadeClass(el: HTMLDivElement | null) {
  if (!el) return "";
  const top = el.scrollTop > 2;
  const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  return `${top ? styles.fadeTop : ""} ${bottom ? styles.fadeBottom : ""}`;
}

// =============================================================================
// Mini SVG Icons for Palette (compact 20x16)
// =============================================================================

const s = "currentColor";
const sw = "0.5";

export function PaletteIconSvg({ type }: { type: ComponentType }) {
  switch (type) {
    case "navigation":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="4" width="18" height="8" rx="1" stroke={s} stroke-width={sw} />
          <rect x="2.5" y="7" width="3" height="1.5" rx=".5" fill={s} opacity=".4" />
          <rect x="7" y="7" width="2.5" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="11" y="7" width="2.5" height="1.5" rx=".5" fill={s} opacity=".25" />
        </svg>
      );
    case "header":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="2" width="18" height="12" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3" y="5.5" width="8" height="2" rx=".5" fill={s} opacity=".35" />
          <rect x="3" y="9" width="12" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "hero":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="1" width="18" height="14" rx="1" stroke={s} stroke-width={sw} />
          <rect x="5" y="5" width="10" height="1.5" rx=".5" fill={s} opacity=".35" />
          <rect x="7" y="8" width="6" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="7.5" y="10.5" width="5" height="2.5" rx="1" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "section":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="1" width="18" height="14" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3" y="4" width="6" height="1" rx=".5" fill={s} opacity=".3" />
          <rect x="3" y="6.5" width="14" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="3" y="9" width="10" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "sidebar":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="1" width="7" height="14" rx="1" stroke={s} stroke-width={sw} />
          <rect x="2.5" y="4" width="4" height="1" rx=".5" fill={s} opacity=".3" />
          <rect x="2.5" y="6.5" width="3.5" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="2.5" y="9" width="4" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "footer":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="7" width="18" height="8" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3" y="9.5" width="4" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="9" y="9.5" width="4" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="15" y="9.5" width="3" height="1" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    case "modal":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="2" width="14" height="12" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="5" y="4.5" width="7" height="1" rx=".5" fill={s} opacity=".3" />
          <rect x="5" y="7" width="10" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="11" y="11" width="5" height="2" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "divider":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <line x1="2" y1="8" x2="18" y2="8" stroke={s} stroke-width="0.5" opacity=".3" />
        </svg>
      );
    case "card":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1" width="16" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="2" y="1" width="16" height="5.5" rx="1" fill={s} opacity=".04" />
          <rect x="4" y="8.5" width="8" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="4" y="11" width="11" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "text":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="4" width="14" height="1.5" rx=".5" fill={s} opacity=".3" />
          <rect x="2" y="7" width="11" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="2" y="9.5" width="13" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="2" y="12" width="8" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "image":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="12" rx="1" stroke={s} stroke-width={sw} />
          <line x1="2" y1="2" x2="18" y2="14" stroke={s} stroke-width=".3" opacity=".25" />
          <line x1="18" y1="2" x2="2" y2="14" stroke={s} stroke-width=".3" opacity=".25" />
        </svg>
      );
    case "video":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="12" rx="1" stroke={s} stroke-width={sw} />
          <path d="M8.5 5.5v5l4.5-2.5z" stroke={s} stroke-width={sw} fill={s} opacity=".15" />
        </svg>
      );
    case "table":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="2" width="18" height="12" rx="1" stroke={s} stroke-width={sw} />
          <line x1="1" y1="5.5" x2="19" y2="5.5" stroke={s} stroke-width=".3" opacity=".25" />
          <line x1="1" y1="9" x2="19" y2="9" stroke={s} stroke-width=".3" opacity=".25" />
          <line x1="7" y1="2" x2="7" y2="14" stroke={s} stroke-width=".3" opacity=".25" />
          <line x1="13" y1="2" x2="13" y2="14" stroke={s} stroke-width=".3" opacity=".25" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1.5" y="2" width="7" height="5.5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="11.5" y="2" width="7" height="5.5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="1.5" y="9.5" width="7" height="5.5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="11.5" y="9.5" width="7" height="5.5" rx="1" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="3.5" cy="4.5" r="1" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="4" width="10" height="1" rx=".5" fill={s} opacity=".2" />
          <circle cx="3.5" cy="8" r="1" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="7.5" width="8" height="1" rx=".5" fill={s} opacity=".2" />
          <circle cx="3.5" cy="11.5" r="1" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="11" width="11" height="1" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="9" width="2.5" height="4" rx=".5" fill={s} opacity=".2" />
          <rect x="7" y="6" width="2.5" height="7" rx=".5" fill={s} opacity=".25" />
          <rect x="11" y="3" width="2.5" height="10" rx=".5" fill={s} opacity=".3" />
          <rect x="15" y="5" width="2.5" height="8" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    case "accordion":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1.5" y="2" width="17" height="4" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3" y="3.5" width="6" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="1.5" y="7.5" width="17" height="3" rx="1" stroke={s} stroke-width={sw} />
          <rect x="1.5" y="12" width="17" height="3" rx="1" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "carousel":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="2" width="14" height="10" rx="1" stroke={s} stroke-width={sw} />
          <path d="M1.5 7L3 8.5 1.5 10" stroke={s} stroke-width={sw} opacity=".35" />
          <path d="M18.5 7L17 8.5 18.5 10" stroke={s} stroke-width={sw} opacity=".35" />
          <circle cx="8.5" cy="14" r=".6" fill={s} opacity=".35" />
          <circle cx="10" cy="14" r=".6" fill={s} opacity=".15" />
          <circle cx="11.5" cy="14" r=".6" fill={s} opacity=".15" />
        </svg>
      );
    case "button":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="5" width="14" height="6" rx="2" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="7.5" width="7" height="1" rx=".5" fill={s} opacity=".25" />
        </svg>
      );
    case "input":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="4" width="5.5" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="2" y="6.5" width="16" height="5.5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3.5" y="8.5" width="7" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="4.5" width="16" height="7" rx="3.5" stroke={s} stroke-width={sw} />
          <circle cx="6" cy="8" r="2" stroke={s} stroke-width={sw} opacity=".3" />
          <line x1="7.5" y1="9.5" x2="9" y2="11" stroke={s} stroke-width={sw} opacity=".3" />
          <rect x="9.5" y="7.5" width="6" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "form":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1.5" width="5.5" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="2" y="3.5" width="16" height="3" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="2" y="8" width="7" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="2" y="10" width="16" height="3" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="12" y="14" width="6" height="2" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "tabs":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="5" width="18" height="10" rx="1" stroke={s} stroke-width={sw} />
          <rect x="1" y="2" width="6" height="3.5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="2.5" y="3.25" width="3" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="7" y="2" width="6" height="3.5" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "dropdown":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="4" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3.5" y="3.5" width="7" height="1" rx=".5" fill={s} opacity=".2" />
          <path d="M15 3.5l1.5 1.5L18 3.5" stroke={s} stroke-width={sw} opacity=".3" />
          <rect x="2" y="7" width="16" height="7" rx="1" stroke={s} stroke-width={sw} stroke-dasharray="2 1" opacity=".3" />
        </svg>
      );
    case "toggle":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="4" y="5" width="12" height="6" rx="3" stroke={s} stroke-width={sw} />
          <circle cx="13" cy="8" r="2" fill={s} opacity=".3" />
        </svg>
      );
    case "avatar":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="10" cy="8" r="6" stroke={s} stroke-width={sw} />
          <circle cx="10" cy="6.5" r="2" stroke={s} stroke-width={sw} />
          <path d="M6.5 13c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "badge":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="5" width="14" height="6" rx="3" stroke={s} stroke-width={sw} />
          <rect x="6" y="7.5" width="8" height="1" rx=".5" fill={s} opacity=".25" />
        </svg>
      );
    case "breadcrumb":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1.5" y="7" width="3.5" height="1" rx=".5" fill={s} opacity=".3" />
          <path d="M6.5 7l1 1-1 1" stroke={s} stroke-width={sw} opacity=".2" />
          <rect x="9" y="7" width="3.5" height="1" rx=".5" fill={s} opacity=".2" />
          <path d="M14 7l1 1-1 1" stroke={s} stroke-width={sw} opacity=".2" />
          <rect x="16.5" y="7" width="2" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "pagination":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="5.5" width="3.5" height="5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="5.5" width="3.5" height="5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="11" y="5.5" width="3.5" height="5" rx="1" fill={s} opacity=".15" stroke={s} stroke-width={sw} />
          <rect x="15.5" y="5.5" width="3.5" height="5" rx="1" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "progress":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="7" width="16" height="2" rx="1" stroke={s} stroke-width={sw} />
          <rect x="2" y="7" width="10" height="2" rx="1" fill={s} opacity=".2" />
        </svg>
      );
    case "toast":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="4" width="16" height="8" rx="1.5" stroke={s} stroke-width={sw} />
          <circle cx="5" cy="8" r="1.5" stroke={s} stroke-width={sw} opacity=".3" />
          <rect x="8" y="6.5" width="7" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="8" y="9" width="5" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "tooltip":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="3" width="14" height="7" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="5.5" y="5.5" width="9" height="1" rx=".5" fill={s} opacity=".25" />
          <path d="M9 10l1 2.5 1-2.5" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "pricing":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1" width="16" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="6" y="3" width="8" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="7" y="5.5" width="6" height="2" rx=".5" fill={s} opacity=".15" />
          <rect x="5" y="9" width="10" height="1" rx=".5" fill={s} opacity=".1" />
          <rect x="5" y="11" width="10" height="1" rx=".5" fill={s} opacity=".1" />
          <rect x="6" y="13" width="8" height="1.5" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    case "testimonial":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1" width="16" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <text x="4" y="5.5" font-size="4" fill={s} opacity=".2" font-family="serif">&ldquo;</text>
          <rect x="4" y="7" width="12" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="4" y="9" width="9" height="1" rx=".5" fill={s} opacity=".12" />
          <circle cx="5.5" cy="12.5" r="1.5" stroke={s} stroke-width={sw} opacity=".25" />
          <rect x="8" y="12" width="5" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "cta":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="2" width="18" height="12" rx="1" stroke={s} stroke-width={sw} />
          <rect x="5" y="4.5" width="10" height="1.5" rx=".5" fill={s} opacity=".3" />
          <rect x="6" y="7.5" width="8" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="7" y="10" width="6" height="2.5" rx="1" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "alert":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="4" width="16" height="8" rx="1.5" stroke={s} stroke-width={sw} />
          <circle cx="6" cy="8" r="2" stroke={s} stroke-width={sw} opacity=".3" />
          <line x1="6" y1="7" x2="6" y2="8.5" stroke={s} stroke-width="0.6" opacity=".5" />
          <circle cx="6" cy="9.3" r=".3" fill={s} opacity=".5" />
          <rect x="9.5" y="7" width="6" height="1" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    case "banner":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1" y="5" width="18" height="6" rx="1" stroke={s} stroke-width={sw} />
          <rect x="4" y="7.5" width="8" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="14" y="7" width="3.5" height="2" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "stat":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="2" width="14" height="12" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="6" y="4.5" width="8" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="5" y="7" width="10" height="2.5" rx=".5" fill={s} opacity=".3" />
          <rect x="7" y="11" width="6" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "stepper":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="4" cy="8" r="2" fill={s} opacity=".2" stroke={s} stroke-width={sw} />
          <line x1="6" y1="8" x2="8" y2="8" stroke={s} stroke-width=".4" opacity=".3" />
          <circle cx="10" cy="8" r="2" stroke={s} stroke-width={sw} />
          <line x1="12" y1="8" x2="14" y2="8" stroke={s} stroke-width=".4" opacity=".3" />
          <circle cx="16" cy="8" r="2" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "tag":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="5" width="14" height="6" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="5.5" y="7.5" width="6" height="1" rx=".5" fill={s} opacity=".25" />
          <line x1="14" y1="6.5" x2="15.5" y2="9.5" stroke={s} stroke-width={sw} opacity=".2" />
          <line x1="15.5" y1="6.5" x2="14" y2="9.5" stroke={s} stroke-width={sw} opacity=".2" />
        </svg>
      );
    case "rating":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <path d="M4 5.5l1 2 2.2.3-1.6 1.5.4 2.2L4 10.3l-2 1.2.4-2.2L.8 7.8 3 7.5z" fill={s} opacity=".25" />
          <path d="M10 5.5l1 2 2.2.3-1.6 1.5.4 2.2L10 10.3l-2 1.2.4-2.2L6.8 7.8 9 7.5z" fill={s} opacity=".25" />
          <path d="M16 5.5l1 2 2.2.3-1.6 1.5.4 2.2L16 10.3l-2 1.2.4-2.2-1.6-1.5 2.2-.3z" stroke={s} stroke-width={sw} opacity=".25" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="12" rx="1" stroke={s} stroke-width={sw} />
          <line x1="2" y1="6" x2="18" y2="10" stroke={s} stroke-width=".3" opacity=".15" />
          <line x1="7" y1="2" x2="11" y2="14" stroke={s} stroke-width=".3" opacity=".15" />
          <path d="M10 5c-1.7 0-3 1.3-3 3 0 2.5 3 5 3 5s3-2.5 3-5c0-1.7-1.3-3-3-3z" fill={s} opacity=".15" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "timeline":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <line x1="5" y1="2" x2="5" y2="14" stroke={s} stroke-width=".4" opacity=".25" />
          <circle cx="5" cy="4" r="1.5" fill={s} opacity=".2" stroke={s} stroke-width={sw} />
          <rect x="8" y="3" width="8" height="1" rx=".5" fill={s} opacity=".25" />
          <circle cx="5" cy="8.5" r="1.5" stroke={s} stroke-width={sw} />
          <rect x="8" y="7.5" width="6" height="1" rx=".5" fill={s} opacity=".15" />
          <circle cx="5" cy="13" r="1.5" stroke={s} stroke-width={sw} />
          <rect x="8" y="12" width="7" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "fileUpload":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="2" width="14" height="12" rx="1.5" stroke={s} stroke-width={sw} stroke-dasharray="2 1" />
          <path d="M10 10V5.5m0 0L7.5 8m2.5-2.5L12.5 8" stroke={s} stroke-width={sw} opacity=".3" />
          <rect x="7" y="11.5" width="6" height="1" rx=".5" fill={s} opacity=".15" />
        </svg>
      );
    case "codeBlock":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="12" rx="1" stroke={s} stroke-width={sw} />
          <circle cx="4" cy="4" r=".6" fill={s} opacity=".3" />
          <circle cx="5.5" cy="4" r=".6" fill={s} opacity=".3" />
          <circle cx="7" cy="4" r=".6" fill={s} opacity=".3" />
          <rect x="4" y="7" width="7" height="1" rx=".5" fill={s} opacity=".2" />
          <rect x="6" y="9" width="5" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="4" y="11" width="8" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="3" width="16" height="12" rx="1" stroke={s} stroke-width={sw} />
          <line x1="2" y1="6.5" x2="18" y2="6.5" stroke={s} stroke-width=".4" opacity=".25" />
          <rect x="5" y="4" width="1" height="1.5" rx=".3" fill={s} opacity=".2" />
          <rect x="14" y="4" width="1" height="1.5" rx=".3" fill={s} opacity=".2" />
          <circle cx="7" cy="9" r=".6" fill={s} opacity=".2" />
          <circle cx="10" cy="9" r=".6" fill={s} opacity=".2" />
          <circle cx="13" cy="9" r=".6" fill={s} opacity=".3" />
          <circle cx="7" cy="12" r=".6" fill={s} opacity=".2" />
          <circle cx="10" cy="12" r=".6" fill={s} opacity=".2" />
        </svg>
      );
    case "notification":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="3" width="16" height="10" rx="1.5" stroke={s} stroke-width={sw} />
          <circle cx="5.5" cy="8" r="2" stroke={s} stroke-width={sw} opacity=".25" />
          <rect x="9" y="6" width="6" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="9" y="8.5" width="4.5" height="1" rx=".5" fill={s} opacity=".12" />
          <circle cx="16.5" cy="4.5" r="1.5" fill={s} opacity=".25" />
        </svg>
      );
    case "productCard":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="1" width="14" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="3" y="1" width="14" height="6" rx="1" fill={s} opacity=".04" />
          <rect x="5" y="8.5" width="7" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="5" y="10.5" width="4" height="1.5" rx=".5" fill={s} opacity=".15" />
          <rect x="12" y="12" width="4" height="2" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="10" cy="5" r="3" stroke={s} stroke-width={sw} />
          <rect x="5" y="10" width="10" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="7" y="12.5" width="6" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "drawer":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="9" y="1" width="10" height="14" rx="1" stroke={s} stroke-width={sw} />
          <rect x="10.5" y="4" width="5" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="10.5" y="6.5" width="7" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="10.5" y="9" width="6" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="1" y="1" width="7" height="14" rx="1" stroke={s} stroke-width={sw} opacity=".15" />
        </svg>
      );
    case "popover":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="2" width="14" height="9" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="5" y="4.5" width="8" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="5" y="7" width="6" height="1" rx=".5" fill={s} opacity=".15" />
          <path d="M9 11l1 2.5 1-2.5" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "logo":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="3" width="10" height="10" rx="2" stroke={s} stroke-width={sw} />
          <path d="M5 9.5l2-4 2 4" stroke={s} stroke-width={sw} opacity=".3" />
          <rect x="14" y="6" width="4" height="1" rx=".5" fill={s} opacity=".2" />
          <rect x="14" y="8.5" width="3" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "faq":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <text x="2.5" y="5.5" font-size="4" fill={s} opacity=".3" font-weight="bold">?</text>
          <rect x="7" y="3" width="10" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="7" y="5.5" width="8" height="1" rx=".5" fill={s} opacity=".12" />
          <text x="2.5" y="11.5" font-size="4" fill={s} opacity=".3" font-weight="bold">?</text>
          <rect x="7" y="9" width="9" height="1" rx=".5" fill={s} opacity=".25" />
          <rect x="7" y="11.5" width="7" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "gallery":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1.5" y="1.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="7.5" y="1.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="13.5" y="1.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="1.5" y="9.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="7.5" y="9.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="13.5" y="9.5" width="5" height="5" rx=".75" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "checkbox":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="5" y="4" width="8" height="8" rx="1.5" stroke={s} stroke-width={sw} />
          <path d="M7.5 8l1.5 1.5 3-3" stroke={s} stroke-width={sw} opacity=".35" />
        </svg>
      );
    case "radio":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="10" cy="8" r="4" stroke={s} stroke-width={sw} />
          <circle cx="10" cy="8" r="2" fill={s} opacity=".3" />
        </svg>
      );
    case "slider":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="7.5" width="16" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="2" y="7.5" width="10" height="1" rx=".5" fill={s} opacity=".25" />
          <circle cx="12" cy="8" r="2.5" stroke={s} stroke-width={sw} />
        </svg>
      );
    case "datePicker":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1" width="16" height="5" rx="1" stroke={s} stroke-width={sw} />
          <rect x="3.5" y="3" width="5" height="1" rx=".5" fill={s} opacity=".2" />
          <rect x="14" y="2.5" width="2.5" height="2" rx=".5" fill={s} opacity=".12" />
          <rect x="2" y="7" width="16" height="8" rx="1" stroke={s} stroke-width={sw} stroke-dasharray="2 1" opacity=".3" />
          <circle cx="6" cy="10" r=".6" fill={s} opacity=".2" />
          <circle cx="10" cy="10" r=".6" fill={s} opacity=".3" />
          <circle cx="14" cy="10" r=".6" fill={s} opacity=".2" />
          <circle cx="6" cy="13" r=".6" fill={s} opacity=".2" />
          <circle cx="10" cy="13" r=".6" fill={s} opacity=".2" />
        </svg>
      );
    case "skeleton":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="16" height="3" rx="1" fill={s} opacity=".08" />
          <rect x="2" y="7" width="10" height="2" rx=".75" fill={s} opacity=".08" />
          <rect x="2" y="11" width="13" height="2" rx=".75" fill={s} opacity=".08" />
        </svg>
      );
    case "chip":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="1.5" y="5" width="10" height="6" rx="3" fill={s} opacity=".08" stroke={s} stroke-width={sw} />
          <rect x="4" y="7.5" width="4" height="1" rx=".5" fill={s} opacity=".25" />
          <line x1="9.5" y1="6.5" x2="10.5" y2="9.5" stroke={s} stroke-width={sw} opacity=".2" />
          <line x1="10.5" y1="6.5" x2="9.5" y2="9.5" stroke={s} stroke-width={sw} opacity=".2" />
          <rect x="13" y="5" width="5.5" height="6" rx="3" stroke={s} stroke-width={sw} opacity=".25" />
        </svg>
      );
    case "icon":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <path d="M10 3l1.5 3 3.5.5-2.5 2.5.5 3.5L10 11l-3 1.5.5-3.5L5 6.5l3.5-.5z" stroke={s} stroke-width={sw} opacity=".3" />
        </svg>
      );
    case "spinner":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="10" cy="8" r="5" stroke={s} stroke-width={sw} opacity=".12" />
          <path d="M10 3a5 5 0 0 1 5 5" stroke={s} stroke-width={sw} opacity=".35" stroke-linecap="round" />
        </svg>
      );
    case "feature":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="1.5" stroke={s} stroke-width={sw} />
          <path d="M4.5 3.5v3m-1.5-1.5h3" stroke={s} stroke-width={sw} opacity=".25" />
          <rect x="9" y="2.5" width="8" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="9" y="5.5" width="6" height="1" rx=".5" fill={s} opacity=".12" />
          <rect x="2" y="10" width="5" height="5" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="9" y="10.5" width="7" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="9" y="13.5" width="5" height="1" rx=".5" fill={s} opacity=".12" />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <circle cx="5" cy="5" r="2.5" stroke={s} stroke-width={sw} />
          <rect x="2.5" y="9" width="5" height="1" rx=".5" fill={s} opacity=".2" />
          <circle cx="15" cy="5" r="2.5" stroke={s} stroke-width={sw} />
          <rect x="12.5" y="9" width="5" height="1" rx=".5" fill={s} opacity=".2" />
          <circle cx="10" cy="5" r="2.5" stroke={s} stroke-width={sw} opacity=".5" />
          <rect x="7.5" y="9" width="5" height="1" rx=".5" fill={s} opacity=".15" />
          <rect x="4" y="12" width="12" height="1" rx=".5" fill={s} opacity=".1" />
        </svg>
      );
    case "login":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="3" y="1" width="14" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="6" y="3" width="8" height="1.5" rx=".5" fill={s} opacity=".25" />
          <rect x="5" y="5.5" width="10" height="3" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="5" y="9.5" width="10" height="3" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="6.5" y="13.5" width="7" height="2" rx=".75" fill={s} opacity=".2" />
        </svg>
      );
    case "contact":
      return (
        <svg viewBox="0 0 20 16" width="20" height="16" fill="none">
          <rect x="2" y="1" width="16" height="14" rx="1.5" stroke={s} stroke-width={sw} />
          <rect x="4" y="3" width="5" height="1" rx=".5" fill={s} opacity=".2" />
          <rect x="4" y="5" width="12" height="2.5" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="4" y="8.5" width="12" height="4" rx=".75" stroke={s} stroke-width={sw} />
          <rect x="11" y="13.5" width="5" height="1.5" rx=".5" fill={s} opacity=".2" />
        </svg>
      );
    default:
      return null;
  }
}

// =============================================================================
// Shared Component Grid (reusable)
// =============================================================================

type ComponentGridProps = {
  activeType: ComponentType | null;
  onSelect: (type: ComponentType) => void;
  onDragStart: (type: ComponentType, e: MouseEvent) => void;
  scrollRef?: Ref<HTMLDivElement | null>;
  fadeClass?: string;
  blankCanvas?: boolean;
};

export function ComponentGrid({ activeType, onSelect, onDragStart, scrollRef, fadeClass, blankCanvas }: ComponentGridProps) {
  return (
    <div ref={scrollRef} class={`${styles.placeScroll} ${fadeClass || ""}`}>
      {COMPONENT_REGISTRY.map((section) => (
        <div key={section.section} class={styles.paletteSection}>
          <div class={styles.paletteSectionTitle}>{section.section}</div>
          {section.items.map((item) => (
            <button
              type="button"
              aria-pressed={activeType === item.type}
              key={item.type}
              class={`${styles.paletteItem} ${activeType === item.type ? styles.active : ""} ${blankCanvas ? styles.wireframe : ""}`}
              onClick={() => onSelect(item.type)}
              onMousedown={(e: MouseEvent) => {
                if (e.button === 0) onDragStart(item.type, e);
              }}
            >
              <span class={styles.paletteItemIcon} aria-hidden="true">
                <PaletteIconSvg type={item.type} />
              </span>
              <span class={styles.paletteItemLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Palette Component
// =============================================================================

// Rolling number animation (old exits, new enters from opposite direction)
// When suffix changes (e.g. "Change" → "Changes"), the whole label rolls.
// When only the number changes, just the number rolls.
const RollingCount = defineComponent({
  name: "RollingCount",
  props: {
    value: { type: Number, required: true },
    suffix: String,
  },
  setup(props) {
    const prev = ref<number | null>(null);
    const prevSuffix = ref(props.suffix);
    const dir = ref<"up" | "down">("up");
    let cur = props.value;
    let curSuffix = props.suffix;
    let timer: ReturnType<typeof originalSetTimeout> | undefined;

    watch(
      [() => props.value, () => props.suffix],
      ([value, suffix]) => {
        if (value !== cur) {
          // Skip animation when hitting 0 — footer is about to collapse anyway
          if (value === 0) {
            cur = value;
            curSuffix = suffix;
            prev.value = null;
            return;
          }
          dir.value = value > cur ? "up" : "down";
          prev.value = cur;
          prevSuffix.value = curSuffix;
          cur = value;
          curSuffix = suffix;
          clearTimeout(timer);
          timer = originalSetTimeout(() => { prev.value = null; }, 250);
        } else {
          curSuffix = suffix;
        }
      },
    );

    return () => {
      const { value, suffix } = props;
      if (prev.value === null) return <>{value}{suffix ? ` ${suffix}` : ""}</>;
      const suffixChanged = prevSuffix.value !== suffix;

      if (suffixChanged) {
        // Suffix changed — roll the whole label
        return (
          <span class={styles.rollingWrap}>
            <span style={{ visibility: "hidden" }}>{value} {suffix}</span>
            <span key={`o${prev.value}-${value}`} class={`${styles.rollingNum} ${dir.value === "up" ? styles.exitUp : styles.exitDown}`}>{prev.value} {prevSuffix.value}</span>
            <span key={`n${value}`} class={`${styles.rollingNum} ${dir.value === "up" ? styles.enterUp : styles.enterDown}`}>{value} {suffix}</span>
          </span>
        );
      }

      // Only number changed — roll just the number
      return (
        <>
          <span class={styles.rollingWrap}>
            <span style={{ visibility: "hidden" }}>{value}</span>
            <span key={`o${prev.value}-${value}`} class={`${styles.rollingNum} ${dir.value === "up" ? styles.exitUp : styles.exitDown}`}>{prev.value}</span>
            <span key={`n${value}`} class={`${styles.rollingNum} ${dir.value === "up" ? styles.enterUp : styles.enterDown}`}>{value}</span>
          </span>
          {suffix ? ` ${suffix}` : ""}
        </>
      );
    };
  },
});

export type DesignPaletteProps = {
  activeType: ComponentType | null;
  onSelect: (type: ComponentType) => void;
  isDarkMode: boolean;
  sectionCount: number;
  onDetectSections: () => void;
  visible: boolean;
  onExited?: () => void;
  placementCount: number;
  onClearPlacements: () => void;
  onDragStart: (type: ComponentType, e: MouseEvent) => void;
  blankCanvas: boolean;
  onBlankCanvasChange: (on: boolean) => void;
  wireframePurpose: string;
  onWireframePurposeChange: (purpose: string) => void;
  Tooltip?: unknown;
};

export const DesignPalette = defineComponent({
  name: "DesignPalette",
  props: {
    activeType: { type: String as PropType<ComponentType | null>, default: null },
    onSelect: { type: Function as PropType<(type: ComponentType) => void>, required: true },
    isDarkMode: Boolean,
    sectionCount: { type: Number, required: true },
    onDetectSections: { type: Function as PropType<() => void>, required: true },
    visible: Boolean,
    onExited: Function as PropType<() => void>,
    placementCount: { type: Number, required: true },
    onClearPlacements: { type: Function as PropType<() => void>, required: true },
    onDragStart: { type: Function as PropType<(type: ComponentType, e: MouseEvent) => void>, required: true },
    blankCanvas: Boolean,
    onBlankCanvasChange: { type: Function as PropType<(on: boolean) => void>, required: true },
    wireframePurpose: { type: String, required: true },
    onWireframePurposeChange: { type: Function as PropType<(purpose: string) => void>, required: true },
    // Accepted for API parity with the React palette; unused there too.
    Tooltip: null as unknown as PropType<unknown>,
  },
  setup(props) {
    const { el: panelRef, mounted } = usePanelPresence(() => props.visible, { onExited: () => props.onExited?.() });
    const footerVisible = ref(false);
    const footerCollapsed = ref(true);
    let lastFooterCount = 0;
    let lastFooterSuffix = "";
    const placeScrollRef = ref<HTMLDivElement | null>(null);
    const placeFade = ref("");

    // Animate footer in/out based on whether there's anything to show
    const hasFooterContent = () => props.placementCount > 0 || props.sectionCount > 0;
    watch(
      hasFooterContent,
      (has, _, onCleanup) => {
        if (has) {
          if (!footerVisible.value) {
            footerCollapsed.value = true;
            footerVisible.value = true;
            originalRequestAnimationFrame(() => {
              originalRequestAnimationFrame(() => {
                footerCollapsed.value = false;
              });
            });
          } else {
            footerCollapsed.value = false;
          }
        } else {
          footerCollapsed.value = true;
          const t = originalSetTimeout(() => { footerVisible.value = false; }, 300);
          onCleanup(() => clearTimeout(t));
        }
      },
      { immediate: true },
    );

    // Scroll fade
    watch(
      [() => props.visible, placeScrollRef],
      ([visible, el], _, onCleanup) => {
        if (!visible || !el) return;
        const update = () => { placeFade.value = scrollFadeClass(el); };
        // ResizeObserver supplies the initial measurement after layout is resolved.
        el.addEventListener("scroll", update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        onCleanup(() => { el.removeEventListener("scroll", update); ro.disconnect(); });
      },
      { flush: "post", immediate: true },
    );

    return () => {
      if (!mounted.value) return null;
      const { blankCanvas, isDarkMode, visible } = props;

      const totalCount = props.placementCount + props.sectionCount;
      if (totalCount > 0) {
        lastFooterCount = totalCount;
        lastFooterSuffix = blankCanvas ? (totalCount === 1 ? "Component" : "Components") : (totalCount === 1 ? "Change" : "Changes");
      }

      return (
        <div
          class={`${styles.palette} ${!isDarkMode ? styles.light : ""}`}
          ref={(node) => {
            panelRef.value = node as HTMLDivElement | null;
            (node as HTMLElement | null)?.toggleAttribute("inert", !visible);
          }}
          aria-hidden={!visible}
          data-feedback-toolbar
          data-agentation-palette
          onClick={(e: MouseEvent) => e.stopPropagation()}
          onMousedown={(e: MouseEvent) => e.stopPropagation()}
        >
          {/* Panel header — fixed title with description */}
          <div class={styles.paletteHeader}>
            <div class={styles.paletteHeaderTitle}>Layout Mode</div>
            <div class={styles.paletteHeaderDesc}>
              Rearrange and resize existing elements, add new components, and explore layout ideas. Agent results may vary.{" "}
              <a href="https://agentation.com/features#layout-mode" target="_blank" rel="noopener noreferrer">Learn more.</a>
            </div>
          </div>

          {/* Wireframe toggle */}
          <button
            type="button"
            aria-pressed={blankCanvas}
            class={`${styles.canvasToggle} ${blankCanvas ? styles.active : ""}`}
            onClick={() => props.onBlankCanvasChange(!blankCanvas)}
          >
            <span class={styles.canvasToggleIcon} aria-hidden="true">
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1" />
                <circle cx="4.5" cy="4.5" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="7" cy="4.5" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="9.5" cy="4.5" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="4.5" cy="7" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="7" cy="7" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="9.5" cy="7" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="4.5" cy="9.5" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="7" cy="9.5" r="0.8" fill="currentColor" opacity=".6" />
                <circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" opacity=".6" />
              </svg>
            </span>
            <span class={styles.canvasToggleLabel}>Wireframe New Page</span>
          </button>
          {/* Wireframe purpose textarea — only when wireframe active */}
          <div
            class={`${styles.wireframePurposeWrap} ${!blankCanvas ? styles.collapsed : ""}`}
            aria-hidden={!blankCanvas}
            ref={(node) => { (node as HTMLElement | null)?.toggleAttribute("inert", !blankCanvas); }}
          >
            <div class={styles.wireframePurposeInner}>
              <textarea
                class={styles.wireframePurposeInput}
                placeholder="Describe this page to provide additional context for your agent."
                value={props.wireframePurpose}
                onInput={(e: Event) => props.onWireframePurposeChange((e.target as HTMLTextAreaElement).value)}
                rows={2}
              />
            </div>
          </div>

          {/* Component grid — always visible */}
          <ComponentGrid
            activeType={props.activeType}
            onSelect={props.onSelect}
            onDragStart={props.onDragStart}
            scrollRef={placeScrollRef}
            fadeClass={placeFade.value}
            blankCanvas={blankCanvas}
          />

          {/* Footer: change count + clear */}
          {footerVisible.value && (
            <div class={`${styles.paletteFooterWrap} ${footerCollapsed.value ? styles.footerHidden : ""}`}>
              <div class={styles.paletteFooterInner}>
                <div class={styles.paletteFooterInnerContent}>
                  <div class={styles.paletteFooter}>
                    <span class={styles.paletteFooterCount}>
                      <RollingCount value={lastFooterCount} suffix={lastFooterSuffix} />
                    </span>
                    <button class={styles.paletteFooterClear} onClick={() => props.onClearPlacements()}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };
  },
});
