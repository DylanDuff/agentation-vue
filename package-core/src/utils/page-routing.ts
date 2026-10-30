/** Current path, plus the hash when feedback is separated by hash location. */
export function readPagePath(useHashLocation: boolean): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + (useHashLocation ? window.location.hash : "");
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
