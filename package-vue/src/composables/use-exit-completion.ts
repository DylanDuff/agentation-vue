import { toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

/** Follow the element's actual CSS exit, cancelling cleanup if it reopens. */
export function useExitCompletion<T extends HTMLElement>(
  el: Ref<T | null | undefined>,
  exiting: MaybeRefOrGetter<boolean>,
  onExited: () => void,
) {
  watch(
    [el, () => toValue(exiting)],
    ([element, isExiting], _, onCleanup) => {
      if (!isExiting || !element) return;
      let cancelled = false;
      const animations = element.getAnimations?.() ?? [];
      // With reduced motion there may be no animation. Finish on the next
      // microtask so the exit render is complete before updating its owner.
      Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (!cancelled) onExited();
      });
      onCleanup(() => { cancelled = true; });
    },
    { flush: "post", immediate: true },
  );
}
