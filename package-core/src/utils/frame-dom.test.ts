import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureFrameContext,
  createFrameProjector,
  createPageEvents,
  frameDocument,
  projectFrameAnnotation,
  viewportPoint,
  viewportRect,
} from "./frame-dom";
import { deepElementFromPoint } from "./hit-testing";
import { getElementPath } from "./element-identification";
import type { Annotation } from "../types";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function frame(doc: Document, left: number, top: number, scale = 1) {
  const el = doc.createElement("iframe");
  doc.body.append(el);
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue(
    new DOMRect(left, top, 204 * scale, 154 * scale),
  );
  Object.defineProperties(el, {
    offsetWidth: { value: 204 },
    offsetHeight: { value: 154 },
    clientLeft: { value: 2 },
    clientTop: { value: 2 },
    clientWidth: { value: 200 },
    clientHeight: { value: 150 },
  });
  return el;
}

describe("same-origin frame picking", () => {
  it("ignores its own portal when watching for new frame documents", async () => {
    const changed = vi.fn();
    const events = createPageEvents(document, changed);
    events.start();
    changed.mockClear();
    const portal = document.createElement("div");
    portal.setAttribute("data-agentation-portal", "");
    document.body.append(portal);
    const host = document.createElement("agentation-toolbar");
    host.attachShadow({ mode: "open" }).innerHTML = "<button>Layout</button>";
    portal.append(host);
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(changed).not.toHaveBeenCalled();
    } finally {
      events.stop();
      portal.remove();
    }
  });

  it("shares frame discovery across notes without carrying stale frames into the next render", () => {
    const el = frame(document, 100, 200);
    const target = el.contentDocument!.createElement("button");
    el.contentDocument!.body.append(target);
    const context = captureFrameContext(target, 122, 232)!;
    const note: Annotation = {
      id: "frame",
      x: 1,
      y: 2,
      timestamp: 1,
      comment: "Move",
      element: "button",
      elementPath: "button",
      frame: context,
    };
    const scan = vi.spyOn(document, "querySelectorAll");
    const project = createFrameProjector();
    expect(project(note)!.y).toBe(232);
    expect(project({ ...note, id: "second" })!.y).toBe(232);
    expect(scan).toHaveBeenCalledOnce();
    el.remove();
    expect(createFrameProjector()(note)).toBeNull();
  });

  it("maps nested borders and scale into the outer viewport", () => {
    const outer = frame(document, 100, 200, 2),
      inner = frame(outer.contentDocument!, 10, 20);
    const target = inner.contentDocument!.createElement("button");
    inner.contentDocument!.body.append(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(5, 6, 20, 10));
    expect(viewportPoint(inner.contentDocument!, 5, 6)).toEqual({ x: 138, y: 260 });
    expect(viewportRect(target).toJSON()).toMatchObject({ x: 138, y: 260, width: 40, height: 20 });
    expect(getElementPath(target)).toContain("⟨iframe⟩");
  });

  it("uses the mounted toolbar document as the viewport when that document is embedded", () => {
    const outer = frame(document, 100, 200, 2);
    const root = outer.contentDocument!;
    const target = root.createElement("p");
    root.body.append(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(5, 6, 20, 10));
    expect(viewportPoint(root, 5, 6, root)).toEqual({ x: 5, y: 6 });
    expect(viewportRect(target, root).toJSON()).toMatchObject({ x: 5, y: 6, width: 20, height: 10 });
    expect(captureFrameContext(target, 5, 6, root)).toBeUndefined();
    const events = createPageEvents(root);
    const listener = vi.fn();
    events.start();
    events.addEventListener("click", listener);
    target.dispatchEvent(new root.defaultView!.MouseEvent("click", { clientX: 5, clientY: 6, bubbles: true }));
    expect(listener.mock.calls[0][0].clientX).toBe(5);
    expect(listener.mock.calls[0][0].clientY).toBe(6);
    events.stop();
  });

  it("projects nested frame annotations only as far as the embedded toolbar document", () => {
    const root = frame(document, 100, 200, 2).contentDocument!;
    const inner = frame(root, 10, 20);
    const target = inner.contentDocument!.createElement("button");
    inner.contentDocument!.body.append(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(5, 6, 20, 10));
    const context = captureFrameContext(target, 17, 28, root)!;
    expect(context.path).toHaveLength(1);
    expect(context).toMatchObject({ x: 5, y: 6 });
    expect(viewportRect(target, root).toJSON()).toMatchObject({ x: 17, y: 28, width: 20, height: 10 });
    const note = { x: 0, y: 0, frame: context };
    expect(createFrameProjector(root)(note)).toMatchObject({ y: 28, boundingBox: { x: 17, y: 28, width: 20, height: 10 } });
    const events = createPageEvents(root);
    const listener = vi.fn();
    events.start();
    events.addEventListener("click", listener);
    target.dispatchEvent(new inner.contentDocument!.defaultView!.MouseEvent("click", { clientX: 5, clientY: 6, bubbles: true }));
    expect(listener.mock.calls[0][0].clientX).toBe(17);
    expect(listener.mock.calls[0][0].clientY).toBe(28);
    events.stop();
  });

  it("picks the child document and then its shadow contents", () => {
    const el = frame(document, 100, 200);
    const host = el.contentDocument!.createElement("custom-button");
    el.contentDocument!.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const button = el.contentDocument!.createElement("button");
    shadow.append(button);
    const rootPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => el);
    el.contentDocument!.elementFromPoint = vi.fn(() => host);
    shadow.elementFromPoint = vi.fn(() => button);
    try {
      expect(deepElementFromPoint(112, 222)).toBe(button);
      expect(el.contentDocument!.elementFromPoint).toHaveBeenCalledWith(10, 20);
    } finally {
      document.elementFromPoint = rootPoint;
    }
  });

  it("does not throw when a frame denies document access", () => {
    const el = frame(document, 0, 0);
    Object.defineProperty(el, "contentDocument", {
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    expect(frameDocument(el)).toBeNull();
  });

  it("tracks dynamically inserted frames and removes detached document listeners", async () => {
    const events = createPageEvents(document);
    events.start();
    const listener = vi.fn();
    events.addEventListener("click", listener, true);
    const el = frame(document, 100, 200);
    await Promise.resolve();
    await Promise.resolve();
    const child = el.contentDocument!;
    const event = new child.defaultView!.MouseEvent("click", {
      clientX: 10,
      clientY: 20,
      bubbles: true,
      cancelable: true,
    });
    child.body.dispatchEvent(event);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].clientX).toBe(112);
    listener.mock.calls[0][0].preventDefault();
    expect(event.defaultPrevented).toBe(true);
    el.remove();
    await Promise.resolve();
    await Promise.resolve();
    child.dispatchEvent(new Event("click"));
    expect(listener).toHaveBeenCalledOnce();
    events.stop();
    document.dispatchEvent(new Event("click"));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("replaces listeners when a frame loads another document", () => {
    const el = frame(document, 0, 0),
      oldDoc = el.contentDocument!;
    const events = createPageEvents(document),
      listener = vi.fn();
    events.start();
    events.addEventListener("keydown", listener);
    oldDoc.dispatchEvent(new Event("keydown"));
    const nextDoc = document.implementation.createHTMLDocument("Next");
    Object.defineProperty(el, "contentDocument", { configurable: true, value: nextDoc });
    el.dispatchEvent(new Event("load"));
    oldDoc.dispatchEvent(new Event("keydown"));
    nextDoc.dispatchEvent(new Event("keydown"));
    expect(listener).toHaveBeenCalledTimes(2);
    events.stop();
    nextDoc.dispatchEvent(new Event("keydown"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reprojects persisted notes after child scrolling and hides them after navigation", () => {
    const el = frame(document, 100, 200);
    el.id = "preview";
    const target = el.contentDocument!.createElement("button");
    el.contentDocument!.body.append(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 80, 30));
    const context = captureFrameContext(target, 122, 232)!;
    const note: Annotation = {
      id: "frame",
      x: 1,
      y: 2,
      timestamp: 1,
      comment: "Move",
      element: "button",
      elementPath: "button",
      frame: context,
    };
    Object.defineProperty(el.contentWindow!, "scrollY", { configurable: true, value: 10 });
    expect(projectFrameAnnotation(note)!.y).toBe(222);
    expect(projectFrameAnnotation(note)!.boundingBox).toMatchObject({ x: 112, y: 212 });
    expect(
      projectFrameAnnotation({
        ...note,
        frame: { ...context, path: [{ ...context.path[0], url: "https://different.test/" }] },
      }),
    ).toBeNull();
  });
});
