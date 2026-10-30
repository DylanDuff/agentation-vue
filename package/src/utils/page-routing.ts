import { useCallback, useSyncExternalStore } from "react";
import { readPagePath } from "@agentation/core/utils/page-routing";

export { runPageTask, matchesPage } from "@agentation/core/utils/page-routing";

export function usePagePath(useHashLocation: boolean): string {
  const subscribe = useCallback((notify: () => void) => {
    if (!useHashLocation) return () => {};
    window.addEventListener("hashchange", notify);
    window.addEventListener("popstate", notify);
    return () => {
      window.removeEventListener("hashchange", notify);
      window.removeEventListener("popstate", notify);
    };
  }, [useHashLocation]);
  return useSyncExternalStore(subscribe, () => readPagePath(useHashLocation), () => "/");
}
