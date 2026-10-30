import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useExitCompletion } from "./use-exit-completion";

function Surface({ exiting, onExited }: { exiting: boolean; onExited: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useExitCompletion(ref, exiting, onExited);
  return <div ref={ref} data-testid="surface" />;
}
function animation(element: HTMLElement) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  Object.defineProperty(element, "getAnimations", { configurable: true, value: () => [{ finished }] });
  return finish;
}
afterEach(cleanup);

it("ignores the previous exit after reopening, including another immediate close", async () => {
  const onExited = vi.fn();
  const view = render(<Surface exiting={false} onExited={onExited} />);
  const element = view.getByTestId("surface");
  const first = animation(element);
  view.rerender(<Surface exiting onExited={onExited} />);
  view.rerender(<Surface exiting={false} onExited={onExited} />);
  const second = animation(element);
  view.rerender(<Surface exiting onExited={onExited} />);
  await act(async () => first());
  expect(onExited).not.toHaveBeenCalled();
  await act(async () => second());
  expect(onExited).toHaveBeenCalledOnce();
});

it("does not finish an exit after its owner unmounts", async () => {
  const onExited = vi.fn();
  const view = render(<Surface exiting={false} onExited={onExited} />);
  const finish = animation(view.getByTestId("surface"));
  view.rerender(<Surface exiting onExited={onExited} />);
  view.unmount();
  await act(async () => finish());
  expect(onExited).not.toHaveBeenCalled();
});

it("finishes without an animation and uses the current callback", async () => {
  const first = vi.fn(), latest = vi.fn();
  const view = render(<Surface exiting onExited={first} />);
  view.rerender(<Surface exiting onExited={latest} />);
  await act(async () => {});
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});
