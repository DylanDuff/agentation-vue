// Toolbar types and constants, split out of the toolbar component so the
// settings panel can import them without a circular import.

export type HoverInfo = {
  element: string;
  elementName: string;
  elementPath: string;
  rect: DOMRect | null;
  reactComponents?: string | null;
  isPiercing?: boolean;
};

export type PendingMultiSelectElement = {
  element: HTMLElement;
  rect: DOMRect;
  name: string;
  path: string;
  reactComponents?: string;
};

export type OutputDetailLevel = "compact" | "standard" | "detailed" | "forensic";
// ReactComponentMode is derived from outputDetail when component detection is on.
// The name is kept from the React package so stored settings stay compatible.
export type ReactComponentMode = "smart" | "filtered" | "all" | "off";
export type MarkerClickBehavior = "edit" | "delete";

export type ToolbarSettings = {
  outputDetail: OutputDetailLevel;
  autoClearAfterCopy: boolean;
  annotationColorId: string;
  blockInteractions: boolean;
  /** Component detection toggle (Vue components in this package) */
  reactEnabled: boolean;
  markerClickBehavior: MarkerClickBehavior;
  webhookUrl: string;
  webhooksEnabled: boolean;
};

export const DEFAULT_SETTINGS: ToolbarSettings = {
  outputDetail: "standard",
  autoClearAfterCopy: false,
  annotationColorId: "blue",
  blockInteractions: true,
  reactEnabled: true,
  markerClickBehavior: "edit",
  webhookUrl: "",
  webhooksEnabled: true,
};

// Simple URL validation - checks for valid http(s) URL format
export const isValidUrl = (url: string): boolean => {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

// Maps output detail level to component detection mode
export const OUTPUT_TO_REACT_MODE: Record<OutputDetailLevel, ReactComponentMode> = {
  compact: "off",
  standard: "filtered",
  detailed: "smart",
  forensic: "all",
};

export const isPrimaryMultiSelectModifierActive = (event: { metaKey: boolean; ctrlKey: boolean }): boolean =>
  event.metaKey || event.ctrlKey;

export const COLOR_OPTIONS = [
  { id: "indigo",  label: "Indigo",  srgb: "#6155F5", p3: "color(display-p3 0.38 0.33 0.96)" },
  { id: "blue",    label: "Blue",    srgb: "#0088FF", p3: "color(display-p3 0.00 0.53 1.00)" },
  { id: "cyan",    label: "Cyan",    srgb: "#00C3D0", p3: "color(display-p3 0.00 0.76 0.82)" },
  { id: "green",   label: "Green",   srgb: "#34C759", p3: "color(display-p3 0.20 0.78 0.35)" },
  { id: "yellow",  label: "Yellow",  srgb: "#FFCC00", p3: "color(display-p3 1.00 0.80 0.00)" },
  { id: "orange",  label: "Orange",  srgb: "#FF8D28", p3: "color(display-p3 1.00 0.55 0.16)" },
  { id: "red",     label: "Red",     srgb: "#FF383C", p3: "color(display-p3 1.00 0.22 0.24)" },
];

export const agentationColorTokensCss = [
  ...COLOR_OPTIONS.map(
    (c) => `
    [data-agentation-accent="${c.id}"] {
      --agentation-color-accent: ${c.srgb};
    }
    @supports (color: color(display-p3 0 0 0)) {
      [data-agentation-accent="${c.id}"] {
        --agentation-color-accent: ${c.p3};
      }
    }
  `,
  ),
  `:host {
    ${COLOR_OPTIONS.map((c) => `--agentation-color-${c.id}: ${c.srgb};`).join("\n")}
  }`,
  `@supports (color: color(display-p3 0 0 0)) {
    :host {
      ${COLOR_OPTIONS.map((c) => `--agentation-color-${c.id}: ${c.p3};`).join("\n")}
    }
  }`,
].join("");
