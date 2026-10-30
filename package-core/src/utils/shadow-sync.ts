import type { Annotation } from "../types";
import { originalSetTimeout } from "./freeze-animations";

type Transport = {
  create(annotation: Annotation): Promise<Annotation>;
  update(id: string, annotation: Annotation): Promise<Annotation>;
  remove(id: string): Promise<void>;
};
type Entry = {
  desired?: Annotation;
  synced?: string;
  running: boolean;
  retries: number;
  timer?: ReturnType<typeof setTimeout>;
};

function pagePath(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url, "http://agentation.invalid");
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return url;
  }
}

/** Serialize layout updates so edits made during a request are delivered next. */
export function createShadowSync(transport: Transport, ids: Map<string, string>, existing: Annotation[] = []) {
  const entries = new Map<string, Entry>();
  const unclaimed = new Map(existing.map(annotation => [annotation.id, annotation]));
  let disposed = false;

  async function flush(id: string, entry: Entry): Promise<void> {
    if (disposed || entry.running || entry.timer) return;
    const desired = entry.desired;
    const serverId = ids.get(id);
    if (!desired && !serverId) {
      entries.delete(id);
      ids.delete(id);
      return;
    }
    const signature = desired ? JSON.stringify(desired) : undefined;
    if (desired && serverId && entry.synced === signature) return;
    entry.running = true;
    try {
      if (!desired) {
        await transport.remove(serverId!);
        ids.delete(id);
        entry.synced = undefined;
      } else if (!serverId) {
        ids.set(id, "");
        const created = await transport.create(desired);
        ids.set(id, created.id);
        entry.synced = signature;
      } else {
        await transport.update(serverId, desired);
        entry.synced = signature;
      }
      entry.retries = 0;
      entry.running = false;
      // A deletion or another edit can arrive while create/PATCH is in flight.
      if (!disposed && entries.get(id) === entry) void flush(id, entry);
    } catch (error) {
      entry.running = false;
      if (!disposed && entries.get(id) === entry) {
        console.warn("[Agentation] Failed to sync layout feedback:", error);
        // PATCH/DELETE are safe to retry. Do not automatically repeat a POST
        // whose response may have been lost after the server accepted it.
        if (ids.get(id) && entry.retries < 3) {
          const delay = 500 * 2 ** entry.retries++;
          entry.timer = originalSetTimeout(() => {
            entry.timer = undefined;
            void flush(id, entry);
          }, delay);
        }
      }
    }
  }

  return {
    replace(annotations: Annotation[]) {
      const desired = new Map(annotations.map(annotation => [annotation.id, annotation]));
      for (const [id, annotation] of desired) {
        let entry = entries.get(id);
        if (!entry) {
          entry = { running: false, retries: 0 };
          entries.set(id, entry);
          // Reuse the saved server record after a page reload. Placement
          // timestamps identify the local item; rearrange selectors identify it.
          const saved = [...unclaimed.values()].find(remote =>
            remote.kind === annotation.kind && pagePath(remote.url) === pagePath(annotation.url) &&
            (annotation.kind === "placement"
              ? remote.timestamp === annotation.timestamp && remote.element === annotation.element
              : remote.element === annotation.element));
          if (saved) {
            ids.set(id, saved.id);
            unclaimed.delete(saved.id);
          }
        }
        if (JSON.stringify(entry.desired) !== JSON.stringify(annotation)) {
          entry.retries = 0;
          if (entry.timer) clearTimeout(entry.timer);
          entry.timer = undefined;
        }
        entry.desired = annotation;
      }
      for (const [id, entry] of entries) {
        if (!desired.has(id)) entry.desired = undefined;
        void flush(id, entry);
      }
    },
    forget(id: string) {
      const entry = entries.get(id);
      if (entry?.timer) clearTimeout(entry.timer);
      entries.delete(id);
      ids.delete(id);
    },
    dispose() {
      disposed = true;
      for (const entry of entries.values()) {
        if (entry.timer) clearTimeout(entry.timer);
      }
    },
  };
}
