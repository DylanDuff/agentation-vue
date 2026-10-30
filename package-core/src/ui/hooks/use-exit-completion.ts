import { useLayoutEffect, useRef, type RefObject } from "react";

/** Follow the element's actual CSS exit, cancelling cleanup if it reopens. */
export function useExitCompletion<T extends HTMLElement>(
  ref: RefObject<T>,
  exiting: boolean,
  onExited: () => void,
) {
  const onExitedRef = useRef(onExited);
  useLayoutEffect(() => { onExitedRef.current = onExited; }, [onExited]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!exiting || !element) return;

    let cancelled = false;
    const animations = element.getAnimations?.() ?? [];
    // With reduced motion there may be no animation. Finish on the next
    // microtask so the exit commit is complete before updating its owner.
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (!cancelled) onExitedRef.current();
    });
    return () => { cancelled = true; };
  }, [ref, exiting]);
}
