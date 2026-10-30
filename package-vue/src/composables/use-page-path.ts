import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

export { runPageTask, matchesPage } from "../utils/page-routing";

const LOCATION_CHANGE = "agentation:locationchange";
let historyPatched = false;

// React re-reads the location on every toolbar render. Vue only re-renders on
// reactive changes, so client-side navigation (vue-router uses pushState) is
// observed by announcing history updates instead.
function patchHistory() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE));
      return result;
    };
  }
}

/** Current path (plus hash when `useHashLocation`), updated on navigation. */
export function usePagePath(useHashLocation: MaybeRefOrGetter<boolean>) {
  const read = () =>
    typeof window === "undefined"
      ? "/"
      : window.location.pathname + (toValue(useHashLocation) ? window.location.hash : "");
  const path = ref(read());
  const update = () => { path.value = read(); };

  if (typeof window !== "undefined") {
    patchHistory();
    window.addEventListener(LOCATION_CHANGE, update);
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    onScopeDispose(() => {
      window.removeEventListener(LOCATION_CHANGE, update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    });
  }
  watch(() => toValue(useHashLocation), update);
  return path;
}
