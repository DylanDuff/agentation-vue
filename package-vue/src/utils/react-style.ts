import type { CSSProperties } from "vue";

// React appends "px" to numeric style values; Vue passes numbers through
// unchanged. Ported style objects go through `rs()` so `top: 12` still means 12px.
const UNITLESS = new Set([
  "animationIterationCount", "aspectRatio", "borderImageOutset", "borderImageSlice", "borderImageWidth",
  "columnCount", "columns", "flex", "flexGrow", "flexPositive", "flexShrink", "flexNegative", "flexOrder",
  "fontWeight", "gridArea", "gridRow", "gridRowEnd", "gridRowSpan", "gridRowStart", "gridColumn",
  "gridColumnEnd", "gridColumnSpan", "gridColumnStart", "lineClamp", "lineHeight", "opacity", "order",
  "orphans", "scale", "tabSize", "widows", "zIndex", "zoom", "fillOpacity", "floodOpacity", "stopOpacity",
  "strokeDasharray", "strokeDashoffset", "strokeMiterlimit", "strokeOpacity", "strokeWidth",
]);

export function rs(style: Record<string, unknown> | undefined | null): CSSProperties | undefined {
  if (!style) return undefined;
  const out: Record<string, unknown> = {};
  for (const key in style) {
    const value = style[key];
    out[key] =
      typeof value === "number" && value !== 0 && !UNITLESS.has(key) && !key.startsWith("--")
        ? `${value}px`
        : value;
  }
  return out as CSSProperties;
}
