import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let timers: Pick<Window, "setTimeout" | "setInterval" | "requestAnimationFrame">;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });
  timers = {
    setTimeout: window.setTimeout,
    setInterval: window.setInterval,
    requestAnimationFrame: window.requestAnimationFrame,
  };
  delete (window as any).__agentation_freeze;
});

afterEach(() => {
  Object.assign(window, timers);
  delete (window as any).__agentation_freeze;
  document.getElementById("feedback-freeze-styles")?.remove();
  vi.useRealTimers();
});

describe("animation freeze lifecycle", () => {
  it("does not patch timers or publish global state on import", async () => {
    await import("./freeze-animations");
    expect(window.setTimeout).toBe(timers.setTimeout);
    expect(window.setInterval).toBe(timers.setInterval);
    expect(window.requestAnimationFrame).toBe(timers.requestAnimationFrame);
    expect(window).not.toHaveProperty("__agentation_freeze");
    expect(document.getElementById("feedback-freeze-styles")).toBeNull();
  });

  it("installs once even when multiple modules were imported before mounting", async () => {
    const first = await import("./freeze-animations");
    vi.resetModules();
    const second = await import("./freeze-animations");
    first.installAnimationFreeze();
    const installedTimeout = window.setTimeout;
    const installedInterval = window.setInterval;
    const installedRAF = window.requestAnimationFrame;
    second.installAnimationFreeze();
    first.installAnimationFreeze();
    expect(window.setTimeout).toBe(installedTimeout);
    expect(window.setInterval).toBe(installedInterval);
    expect(window.requestAnimationFrame).toBe(installedRAF);

    const callback = vi.fn();
    second.freeze();
    window.setTimeout(callback, 10);
    vi.advanceTimersByTime(10);
    expect(callback).not.toHaveBeenCalled();
    first.unfreeze();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("queues host timeouts while toolbar timers keep running, then replays once", async () => {
    const { installAnimationFreeze, freeze, unfreeze, originalSetTimeout } = await import("./freeze-animations");
    installAnimationFreeze();
    const host = vi.fn();
    const toolbar = vi.fn();
    window.setTimeout(host, 20, "host argument");
    originalSetTimeout(toolbar, 20, "toolbar argument");
    freeze();
    vi.advanceTimersByTime(20);
    expect(host).not.toHaveBeenCalled();
    expect(toolbar).toHaveBeenCalledWith("toolbar argument");
    unfreeze();
    vi.advanceTimersByTime(1);
    expect(host).toHaveBeenCalledOnce();
    expect(host).toHaveBeenCalledWith("host argument");
    unfreeze();
    vi.advanceTimersByTime(20);
    expect(host).toHaveBeenCalledOnce();
  });

  it("skips frozen interval ticks and resumes at the existing cadence", async () => {
    const { installAnimationFreeze, freeze, unfreeze } = await import("./freeze-animations");
    installAnimationFreeze();
    const callback = vi.fn();
    const timer = window.setInterval(callback, 10, "tick");
    vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith("tick");
    freeze();
    vi.advanceTimersByTime(30);
    expect(callback).toHaveBeenCalledOnce();
    unfreeze();
    vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledTimes(2);
    window.clearInterval(timer);
  });

  it("installs for direct freeze calls and resumes queued animation frames", async () => {
    const { freeze, unfreeze, originalRequestAnimationFrame } = await import("./freeze-animations");
    freeze();
    const host = vi.fn();
    const toolbar = vi.fn();
    window.requestAnimationFrame(host);
    originalRequestAnimationFrame(toolbar);
    vi.advanceTimersByTime(32);
    expect(host).not.toHaveBeenCalled();
    expect(toolbar).toHaveBeenCalledOnce();
    unfreeze();
    vi.advanceTimersByTime(32);
    expect(host).toHaveBeenCalledOnce();
    expect(host.mock.calls[0][0]).toEqual(expect.any(Number));
  });
});
