/** Current path, plus the hash when feedback is separated by hash location. */
export function readPagePath(useHashLocation: boolean): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + (useHashLocation ? window.location.hash : "");
}

const LOCATION_CHANGE = "agentation:locationchange";
let historyPatched = false;

// Client-side routers navigate with pushState, which fires no event. Announce
// history updates so a toolbar outside the app's render tree can follow them.
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

/** Calls `notify` after any navigation: pushState, replaceState, back/forward or hash changes. */
export function subscribeToNavigation(notify: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  patchHistory();
  window.addEventListener(LOCATION_CHANGE, notify);
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  return () => {
    window.removeEventListener(LOCATION_CHANGE, notify);
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
  };
}

// A route can unmount while a request is in flight, then mount again before
// the response arrives. Finish its writes before the new instance reads it.
const pending = new Map<string, Promise<void>>();
export function runPageTask<T>(key: string, work: () => Promise<T>): Promise<T> {
  const task = (pending.get(key) ?? Promise.resolve()).then(work);
  const settled = task.then(() => {}, () => {});
  pending.set(key, settled);
  void settled.then(() => {
    if (pending.get(key) === settled) pending.delete(key);
  });
  return task;
}

export function matchesPage(url: string, pathname: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && parsed.pathname + parsed.hash === pathname;
  } catch {
    return false;
  }
}
