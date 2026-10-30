import { onBeforeUnmount, onMounted, onUpdated, shallowRef, watch, type ShallowRef } from "vue";

// The toolbar is ported from a large React component whose behaviour depends
// on effect timing (run after render, re-run when a dependency changes,
// clean up first). These helpers keep that timing inside a Vue setup() so the
// port can follow upstream line for line.

export type SetStateAction<T> = T | ((previous: T) => T);
export type Dispatch<A> = (value: A) => void;
export type StateTuple<T> = [ShallowRef<T>, Dispatch<SetStateAction<T>>];

/** A shallow ref plus a setter that accepts a value or an updater. */
export function useState<T>(initial: T | (() => T)): StateTuple<T> {
  const state = shallowRef(
    typeof initial === "function" ? (initial as () => T)() : initial,
  ) as ShallowRef<T>;
  const set: Dispatch<SetStateAction<T>> = (value) => {
    state.value = typeof value === "function"
      ? (value as (previous: T) => T)(state.value)
      : value;
  };
  return [state, set];
}

/** A plain mutable box; changing it never re-renders. */
export function useRef<T>(initial: T): { current: T };
export function useRef<T>(initial: T | null): { current: T | null };
export function useRef<T = undefined>(): { current: T | undefined };
export function useRef<T>(initial?: T) {
  return { current: initial };
}

/** Template ref callback that stores the element (or exposed instance) in a box. */
export function setRef<T>(box: { current: T | null }) {
  return (el: unknown) => {
    box.current = (el ?? null) as T | null;
  };
}

type EffectCallback = () => void | (() => void);

/**
 * Runs after mount, then after any render where a dependency changed
 * (compared with Object.is). Without dependencies it runs after every render.
 */
export function useEffect(effect: EffectCallback, deps?: () => readonly unknown[]) {
  let cleanup: void | (() => void);
  const run = () => {
    if (typeof cleanup === "function") cleanup();
    cleanup = effect();
  };

  onMounted(() => {
    if (!deps) {
      run();
      return;
    }
    let previous = deps();
    // Watch before the first run so state the effect sets is still noticed.
    watch(deps, (next) => {
      if (next.length === previous.length && next.every((value, i) => Object.is(value, previous[i]))) return;
      previous = next;
      run();
    }, { flush: "post" });
    run();
  });
  if (!deps) onUpdated(run);
  onBeforeUnmount(() => {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
  });
}

/** Same timing as useEffect: Vue's post flush already runs before paint. */
export const useLayoutEffect = useEffect;
