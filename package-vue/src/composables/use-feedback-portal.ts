import { onMounted, onUnmounted, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";

/** Move one Teleport target between host overlays without remounting its state. */
export function useFeedbackPortal(container?: MaybeRefOrGetter<HTMLElement | ShadowRoot | null | undefined>) {
  const portalHost = shallowRef<HTMLDivElement | null>(null);

  onMounted(() => {
    const host = document.createElement("div");
    host.setAttribute("data-agentation-portal", "");
    host.style.display = "contents";
    portalHost.value = host;
  });
  onUnmounted(() => portalHost.value?.remove());

  watch(
    [portalHost, () => toValue(container)],
    ([host, target]) => {
      if (!host) return;
      const parent = target ?? document.body;
      // Coordinate calculations belong to this document. Iframe selection is
      // handled by the picker, not by mounting the toolbar into another window.
      if (parent.ownerDocument !== document) {
        console.warn("[Agentation] portalContainer belongs to another document; the toolbar will not render.");
        return;
      }
      let focused = document.activeElement;
      while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
      const restoreFocus = focused && host.contains(document.activeElement) ? (focused as HTMLElement) : null;
      if (typeof host.hidePopover === "function" && host.matches(":popover-open")) host.hidePopover();
      parent.appendChild(host);
      if (target && typeof host.showPopover === "function") {
        // Keep DOM ownership inside the modal for focus/aria, while escaping its
        // transforms and overflow so all coordinates remain viewport-relative.
        host.setAttribute("popover", "manual");
        host.style.cssText =
          "position:fixed;inset:0 auto auto 0;margin:0;padding:0;border:0;background:transparent;width:0;height:0;overflow:visible;pointer-events:none";
        host.showPopover();
      } else {
        host.removeAttribute("popover");
        host.style.cssText = "display:contents";
      }
      restoreFocus?.focus({ preventScroll: true });
    },
    { flush: "sync" },
  );

  return portalHost;
}
