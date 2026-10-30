import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLatestAction } from "./use-latest-action";

vi.mock("@agentation/core/utils/freeze-animations", () => ({
  originalSetTimeout: (callback: () => void, delay: number) =>
    setTimeout(callback, delay),
}));
afterEach(() => vi.useRealTimers());

it("gives repeated feedback a full duration and cancels the earlier clear", () => {
  vi.useFakeTimers();
  const { result } = renderHook(useLatestAction);
  const first = result.current.start();
  const clear = vi.fn();
  const reset = vi.fn();
  result.current.schedule(first, clear, 500);
  act(() => vi.advanceTimersByTime(400));
  const second = result.current.start();
  result.current.schedule(second, reset, 2000);
  act(() => vi.advanceTimersByTime(1600));
  expect(clear).not.toHaveBeenCalled();
  expect(reset).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(400));
  expect(reset).toHaveBeenCalledOnce();
  expect(result.current.isCurrent(first)).toBe(false);
});

it("invalidates async results and clears scheduled work on unmount", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useLatestAction);
  const action = result.current;
  const id = action.start();
  const clear = vi.fn();
  action.schedule(id, clear, 500);
  unmount();
  action.schedule(id, clear, 500);
  act(() => vi.runAllTimers());
  expect(action.isCurrent(id)).toBe(false);
  expect(clear).not.toHaveBeenCalled();
});
