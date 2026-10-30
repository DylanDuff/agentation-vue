import { onScopeDispose } from "vue";
import { originalSetTimeout } from "@agentation/core/utils/freeze-animations";

export type LatestAction = ReturnType<typeof createLatestAction>;

export function createLatestAction() {
  let sequence = 0;
  const timers = new Set<ReturnType<typeof originalSetTimeout>>();
  const start = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    return ++sequence;
  };
  const isCurrent = (id: number) => id === sequence;
  const schedule = (id: number, callback: () => void, delay: number) => {
    if (!isCurrent(id)) return;
    const timer = originalSetTimeout(() => {
      timers.delete(timer);
      if (isCurrent(id)) callback();
    }, delay);
    timers.add(timer);
  };
  return { start, isCurrent, schedule };
}

/** A new action supersedes earlier results and their delayed feedback. */
export function useLatestAction() {
  const action = createLatestAction();
  onScopeDispose(() => { action.start(); });
  return action;
}
