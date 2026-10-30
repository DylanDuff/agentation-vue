import { useLayoutEffect, useRef, useState } from "react";

/** Native CSS transitions own motion; presence waits for their actual exit. */
export function usePanelPresence(
  open: boolean,
  { keepMounted = false, onExited }: { keepMounted?: boolean; onExited?: () => void } = {},
) {
  const [mounted, setMounted] = useState(keepMounted || open);
  const ref = useRef<HTMLDivElement | null>(null);
  const onExitedRef = useRef(onExited);

  // Include the opening panel in the trigger's commit, before its first paint.
  if (open && !mounted) setMounted(true);
  useLayoutEffect(() => { onExitedRef.current = onExited; }, [onExited]);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || (panel.dataset.panelOpen === "true") === open) return;

    // Establish the starting style for a newly mounted panel. Existing CSS
    // transitions reverse from their current presentation without cancellation.
    getComputedStyle(panel).opacity;
    panel.dataset.panelPresent = "true";
    panel.dataset.panelOpen = String(open);

    let cancelled = false;
    const transitions = panel.getAnimations?.() ?? [];
    Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
      if (cancelled || open) return;
      delete panel.dataset.panelPresent;
      if (!keepMounted) setMounted(false);
      onExitedRef.current?.();
    });
    // A reopen invalidates exit cleanup. Reduced motion (including a preference
    // change during an exit) is handled by CSS cancelling the transitions.
    return () => { cancelled = true; };
  }, [open, mounted, keepMounted]);

  return { ref, mounted };
}
