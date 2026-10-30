import { useCallback, useSyncExternalStore } from "react";
import { readPagePath, subscribeToNavigation } from "../../utils/page-routing";

export { runPageTask, matchesPage } from "../../utils/page-routing";

/**
 * Current path (plus hash when `useHashLocation`). Inside React the host app's
 * re-renders refresh it; `observeNavigation` also follows pushState for
 * adapters whose toolbar is not re-rendered by the app's router.
 */
export function usePagePath(useHashLocation: boolean, observeNavigation = false): string {
  const subscribe = useCallback((notify: () => void) => {
    if (observeNavigation) return subscribeToNavigation(notify);
    if (!useHashLocation) return () => {};
    window.addEventListener("hashchange", notify);
    window.addEventListener("popstate", notify);
    return () => {
      window.removeEventListener("hashchange", notify);
      window.removeEventListener("popstate", notify);
    };
  }, [useHashLocation, observeNavigation]);
  return useSyncExternalStore(subscribe, () => readPagePath(useHashLocation), () => "/");
}
