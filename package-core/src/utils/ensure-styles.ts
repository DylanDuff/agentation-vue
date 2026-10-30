const ATTR = "data-agentation-styles";

/**
 * Appends a component stylesheet to the root that renders it: the document
 * head for consumers who use the exported components directly, or a host
 * shadow root. The toolbar's own shadow stylesheet bundles every component
 * stylesheet, so nothing is added inside it.
 */
export function ensureStyles(root: Node | null | undefined, id: string, css: string | undefined): void {
  if (!css || !root) return;
  const container: ParentNode | null =
    root.nodeType === 9 ? (root as Document).head : root.nodeType === 11 ? (root as ShadowRoot) : null;
  if (!container || typeof container.querySelector !== "function") return;
  if (container.querySelector(`style[${ATTR}~="toolbar"], style[${ATTR}~="${id}"]`)) return;
  const doc = root.nodeType === 9 ? (root as Document) : (root as ShadowRoot).ownerDocument;
  const style = doc.createElement("style");
  style.setAttribute(ATTR, id);
  style.textContent = css;
  container.appendChild(style);
}
