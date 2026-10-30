import { useEffect, useLayoutEffect, useState } from "react";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Move one portal between host overlays without remounting its React state. */
export function useFeedbackPortal(container?: HTMLElement | ShadowRoot | null) {
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  useBrowserLayoutEffect(() => {
    const host = document.createElement("div");
    host.setAttribute("data-agentation-portal", "");
    host.style.display = "contents";
    setPortalHost(host);
    return () => host.remove();
  }, []);
  useBrowserLayoutEffect(() => {
    if (!portalHost) return;
    const target = container ?? document.body;
    // Coordinate calculations belong to this document. Iframe selection is
    // handled by the picker, not by mounting the toolbar into another window.
    if (target.ownerDocument !== document) {
      console.warn("[Agentation] portalContainer belongs to another document; the toolbar will not render.");
      return;
    }
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    const restoreFocus =
      focused && portalHost.contains(document.activeElement) ? (focused as HTMLElement) : null;
    if (typeof portalHost.hidePopover === "function" && portalHost.matches(":popover-open"))
      portalHost.hidePopover();
    target.appendChild(portalHost);
    if (container && typeof portalHost.showPopover === "function") {
      // Keep DOM ownership inside the modal for focus/aria, while escaping its
      // transforms and overflow so all coordinates remain viewport-relative.
      portalHost.setAttribute("popover", "manual");
      portalHost.style.cssText =
        "position:fixed;inset:0 auto auto 0;margin:0;padding:0;border:0;background:transparent;width:0;height:0;overflow:visible;pointer-events:none";
      portalHost.showPopover();
    } else {
      portalHost.removeAttribute("popover");
      portalHost.style.cssText = "display:contents";
    }
    restoreFocus?.focus({ preventScroll: true });
  }, [portalHost, container]);
  return portalHost;
}
