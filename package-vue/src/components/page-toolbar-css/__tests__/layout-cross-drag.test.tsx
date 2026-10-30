import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "../../../test-utils";
import { PageFeedbackToolbarCSS } from "../index";
import {
  loadDesignPlacements, loadRearrangeState, saveDesignPlacements, saveRearrangeState,
} from "@agentation/core/utils/storage";
import type { DesignPlacement, RearrangeState } from "@agentation/core/design-mode/types";

beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mixed layout selection", () => {
  it.each([
    { source: "placement", cancelled: false },
    { source: "section", cancelled: false },
    { source: "section", cancelled: true },
  ])("moves mixed overlays from $source and cleans up on release (cancelled: $cancelled)", async ({ source, cancelled }) => {
    const pathname = window.location.pathname;
    const placement: DesignPlacement = {
      id: "placement", type: "card", x: 400, y: 400,
      width: 100, height: 100, scrollY: 0, timestamp: Date.now(),
    };
    const rect = { x: 40, y: 40, width: 180, height: 100 };
    saveDesignPlacements(pathname, [placement]);
    saveRearrangeState<RearrangeState>(pathname, {
      sections: [{
        id: "section", label: "Existing section", tagName: "section", selector: "#layout-section",
        role: null, className: null, textSnippet: null, originalRect: rect, currentRect: rect, originalIndex: 0,
      }],
      originalOrder: ["section"], detectedAt: Date.now(),
    });
    await render(<><section id="layout-section">Existing section</section><PageFeedbackToolbarCSS /></>);
    vi.spyOn(document.getElementById("layout-section")!, "getBoundingClientRect").mockReturnValue({
      ...rect, top: rect.y, left: rect.x, bottom: rect.y + rect.height, right: rect.x + rect.width,
      toJSON: () => rect,
    });
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    await fireEvent.keyDown(document, { key: "l" });
    const root = document.querySelector("agentation-toolbar")!.shadowRoot!;
    const added = root.querySelector<HTMLElement>('[data-design-placement="placement"]')!;
    const existing = root.querySelector<HTMLElement>('[data-rearrange-section="section"]')!;
    expect(added).not.toBeNull();
    expect(existing).not.toBeNull();

    await fireEvent.mouseDown(added, { button: 0, clientX: 420, clientY: 420 });
    await fireEvent.mouseUp(window, { clientX: 420, clientY: 420 });
    await fireEvent.mouseDown(existing, { button: 0, shiftKey: true, clientX: 60, clientY: 60 });
    await fireEvent.mouseUp(window, { clientX: 60, clientY: 60 });
    expect(added.className).toContain("selected");
    expect(existing.className).toContain("selected");

    const dragged = source === "placement" ? added : existing;
    const companion = source === "placement" ? existing : added;
    await fireEvent.mouseDown(dragged, { button: 0, clientX: 100, clientY: 100 });
    await fireEvent.mouseMove(window, { clientX: 160, clientY: 130 });
    expect(companion.style.transform).toBe("translate(60px, 30px)");
    await fireEvent.mouseUp(window, cancelled ? { clientX: 100, clientY: 100 } : { clientX: 160, clientY: 130 });
    expect(companion.style.transform).toBe("");
    expect(loadDesignPlacements<DesignPlacement>(pathname)[0]).toMatchObject(cancelled ? { x: 400, y: 400 } : { x: 460, y: 430 });
    expect(loadRearrangeState<RearrangeState>(pathname)?.sections[0].currentRect).toMatchObject(cancelled ? rect : { x: 100, y: 70 });
    await act(async () => {});
  });
});


describe("layout preview ownership", () => {
  it("leaves host styles untouched through opening, interrupted closing and unmount", async () => {
    const rect = { x: 40, y: 40, width: 180, height: 100 };
    saveRearrangeState<RearrangeState>(window.location.pathname, {
      sections: [{
        id: "host-section", label: "Host content", tagName: "span", selector: "#host-content",
        role: null, className: null, textSnippet: null, originalRect: rect,
        currentRect: { ...rect, x: 100 }, originalIndex: 0,
      }],
      originalOrder: ["host-section"], detectedAt: Date.now(),
    });
    const host = document.createElement("div");
    host.style.overflow = "hidden";
    const target = document.createElement("span");
    target.id = "host-content";
    target.textContent = "Host content";
    target.style.cssText = "display: inline; transition: opacity 200ms; transform: translateX(2px); z-index: 3;";
    host.append(target);
    document.body.append(host);
    const original = { target: target.style.cssText, host: host.style.cssText };
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      ...rect, top: rect.y, left: rect.x, bottom: rect.y + rect.height, right: rect.x + rect.width,
      toJSON: () => rect,
    });
    const view = await render(<PageFeedbackToolbarCSS />);
    const unchanged = () => {
      expect(target.style.cssText).toBe(original.target);
      expect(host.style.cssText).toBe(original.host);
    };
    try {
      await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
      await fireEvent.keyDown(document, { key: "l" });
      unchanged();
      await fireEvent.keyDown(document, { key: "l" });
      await fireEvent.keyDown(document, { key: "l" });
      await act(() => new Promise(resolve => setTimeout(resolve, 500)));
      unchanged();
      await view.unmount();
      await act(() => new Promise(resolve => setTimeout(resolve, 500)));
      unchanged();
    } finally {
      await view.unmount();
      host.remove();
    }
  });
});
