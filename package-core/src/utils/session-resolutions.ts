import type { Annotation } from "../types";
import { originalSetInterval, originalSetTimeout } from "./freeze-animations";
import { getAnnotation } from "./sync";

/**
 * Keep terminal annotation statuses current even if a proxy silently loses SSE.
 *
 * `localIds` lists the feedback shown on the page. Any of them that live in a
 * different session (synced before the page joined this one) get no events
 * here, so each periodic check also looks those up by ID.
 */
export function subscribeSessionResolutions(
  endpoint: string,
  sessionId: string,
  hasPending: () => boolean,
  onResolved: (annotation: Annotation) => void,
  localIds: () => readonly string[] = () => [],
) {
  let disposed = false;
  let disconnect: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;
  let request: AbortController | undefined;
  const apply = (annotation: Annotation) => {
    if (!disposed && (annotation?.status === "resolved" || annotation?.status === "dismissed")) {
      onResolved(annotation);
    }
  };
  const reconcile = async () => {
    if (disposed || request || !hasPending()) return;
    const current = new AbortController();
    request = current;
    const timeout = originalSetTimeout(() => current.abort(), 5000);
    try {
      const response = await fetch(`${endpoint}/sessions/${sessionId}`, { signal: current.signal });
      if (!response.ok) return;
      const session = await response.json();
      if (disposed || current.signal.aborted || !Array.isArray(session.annotations)) return;
      const annotations: Annotation[] = session.annotations;
      annotations.forEach(apply);
      const inSession = new Set(annotations.map(annotation => annotation.id));
      const elsewhere = localIds().filter(id => !inSession.has(id));
      const remote = await Promise.all(elsewhere.map(id =>
        getAnnotation(endpoint, id, current.signal).catch(() => null)));
      if (!current.signal.aborted) remote.forEach(annotation => annotation && apply(annotation));
    } catch {
      // Keep local work intact and retry at the next check.
    } finally {
      clearTimeout(timeout);
      if (request === current) request = undefined;
    }
  };
  const connect = () => {
    if (disposed) return;
    const source = new EventSource(`${endpoint}/sessions/${sessionId}/events`);
    const open = () => { retryDelay = 1000; void reconcile(); };
    const update = (event: Event) => {
      try { apply(JSON.parse((event as MessageEvent).data).payload); } catch { /* Ignore malformed events. */ }
    };
    const error = () => {
      // CONNECTING retries are handled natively. A terminal HTTP error leaves
      // EventSource CLOSED, so recovery requires a new instance.
      if (source.readyState !== EventSource.CLOSED || disposed || retry !== undefined) return;
      disconnect?.();
      retry = originalSetTimeout(() => { retry = undefined; connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10000);
    };
    source.addEventListener("open", open);
    source.addEventListener("annotation.updated", update);
    source.addEventListener("error", error);
    disconnect = () => {
      source.removeEventListener("open", open);
      source.removeEventListener("annotation.updated", update);
      source.removeEventListener("error", error);
      source.close();
    };
  };
  connect();
  // Health alone cannot detect a stream left open by an intermediary. Only
  // check while this page has feedback that might have been resolved remotely.
  const interval = originalSetInterval(() => { void reconcile(); }, 10000);
  return () => {
    disposed = true;
    disconnect?.();
    if (retry !== undefined) clearTimeout(retry);
    clearInterval(interval);
    request?.abort();
  };
}
