import { act, cleanup, render } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelPresence } from "./use-panel-presence";

function Panel({ open, keepMounted = false, onExited = () => {} }: {
  open: boolean; keepMounted?: boolean; onExited?: () => void;
}) {
  const { ref, mounted } = usePanelPresence(open, { keepMounted, onExited });
  return mounted ? <div ref={ref} data-testid="panel" /> : null;
}
function animation() {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  return { finished, finish, cancel: vi.fn() };
}
const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations");
let runs: ReturnType<typeof animation>[];
let getAnimations: ReturnType<typeof vi.fn>;
beforeEach(() => {
  runs = [];
  getAnimations = vi.fn(() => {
    const run = animation();
    runs.push(run);
    return [run];
  });
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: getAnimations });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (descriptor) Object.defineProperty(HTMLElement.prototype, "getAnimations", descriptor);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
});

describe("panel presence", () => {
  it("opens in one commit without a blocking nested update", () => {
    const committed = vi.fn();
    const view = render(<Profiler id="panel" onRender={committed}><Panel open={false} /></Profiler>);
    committed.mockClear();
    view.rerender(<Profiler id="panel" onRender={committed}><Panel open /></Profiler>);
    expect(view.getByTestId("panel").dataset.panelOpen).toBe("true");
    expect(committed).toHaveBeenCalledOnce();
  });

  it("keeps the closing surface visible until its actual animation finishes", async () => {
    const exited = vi.fn();
    const view = render(<Panel open onExited={exited} />);
    const panel = view.getByTestId("panel");
    view.rerender(<Panel open={false} onExited={exited} />);
    expect(panel.isConnected).toBe(true);
    expect(panel.dataset.panelPresent).toBe("true");
    expect(panel.dataset.panelOpen).toBe("false");
    expect(exited).not.toHaveBeenCalled();
    await act(async () => runs[1].finish());
    expect(panel.isConnected).toBe(false);
    expect(exited).toHaveBeenCalledOnce();
  });

  it("reverses an interrupted exit on the same element without stale cleanup", async () => {
    const exited = vi.fn();
    const view = render(<Panel open onExited={exited} />);
    const panel = view.getByTestId("panel");
    view.rerender(<Panel open={false} onExited={exited} />);
    view.rerender(<Panel open onExited={exited} />);
    await act(async () => runs[1].finish());
    // CSS retargets the transition; the old completion cannot remove it.
    expect(view.getByTestId("panel")).toBe(panel);
    expect(panel.dataset.panelOpen).toBe("true");
    expect(panel.dataset.panelPresent).toBe("true");
    expect(exited).not.toHaveBeenCalled();
  });

  it("uses only the latest exit when open and close are repeated", async () => {
    const exited = vi.fn();
    const view = render(<Panel open onExited={exited} />);
    view.rerender(<Panel open={false} onExited={exited} />);
    view.rerender(<Panel open onExited={exited} />);
    view.rerender(<Panel open={false} onExited={exited} />);
    await act(async () => runs[1].finish());
    expect(view.queryByTestId("panel")).not.toBeNull();
    expect(exited).not.toHaveBeenCalled();
    await act(async () => runs[3].finish());
    expect(view.queryByTestId("panel")).toBeNull();
    expect(exited).toHaveBeenCalledOnce();
  });

  it("retains a panel after its exit and cancels work when unmounted", async () => {
    const exited = vi.fn();
    const view = render(<Panel open keepMounted onExited={exited} />);
    const panel = view.getByTestId("panel");
    view.rerender(<Panel open={false} keepMounted onExited={exited} />);
    await act(async () => runs[1].finish());
    expect(view.getByTestId("panel")).toBe(panel);
    expect(panel.dataset.panelOpen).toBe("false");
    expect(panel.dataset.panelPresent).toBeUndefined();
    view.rerender(<Panel open keepMounted onExited={exited} />);
    view.unmount();
    await act(async () => runs[2].finish());
    expect(exited).toHaveBeenCalledOnce();
  });

  it("settles without a presentation delay when CSS produces no transition", async () => {
    getAnimations.mockReturnValue([]);
    const exited = vi.fn();
    const view = render(<Panel open onExited={exited} />);
    await act(async () => view.rerender(<Panel open={false} onExited={exited} />));
    expect(view.queryByTestId("panel")).toBeNull();
    expect(getAnimations).toHaveBeenCalledTimes(2);
    expect(exited).toHaveBeenCalledOnce();
  });
});
