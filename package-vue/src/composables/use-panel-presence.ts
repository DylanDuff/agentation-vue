import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";

/** Native CSS transitions own motion; presence waits for their actual exit. */
export function usePanelPresence(
  open: MaybeRefOrGetter<boolean>,
  { keepMounted = false, onExited }: { keepMounted?: boolean; onExited?: () => void } = {},
) {
  const mounted = ref(keepMounted || toValue(open));
  const el = ref<HTMLDivElement | null>(null);

  // Include the opening panel in the trigger's render, before its first paint.
  watch(() => toValue(open), (isOpen) => { if (isOpen) mounted.value = true; }, { flush: "sync" });

  watch(
    [() => toValue(open), mounted, el],
    ([isOpen], _, onCleanup) => {
      const panel = el.value;
      if (!panel || (panel.dataset.panelOpen === "true") === isOpen) return;

      // Establish the starting style for a newly mounted panel. Existing CSS
      // transitions reverse from their current presentation without cancellation.
      getComputedStyle(panel).opacity;
      panel.dataset.panelPresent = "true";
      panel.dataset.panelOpen = String(isOpen);

      let cancelled = false;
      const transitions = panel.getAnimations?.() ?? [];
      Promise.allSettled(transitions.map((transition) => transition.finished)).then(() => {
        if (cancelled || isOpen) return;
        delete panel.dataset.panelPresent;
        if (!keepMounted) mounted.value = false;
        onExited?.();
      });
      // A reopen invalidates exit cleanup. Reduced motion is handled by CSS
      // cancelling the transitions.
      onCleanup(() => { cancelled = true; });
    },
    { flush: "post", immediate: true },
  );

  return { el, mounted };
}
