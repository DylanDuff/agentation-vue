import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "../../../test-utils";
import { PageFeedbackToolbarCSS, type AgentationProps } from "../index";
import { getStorageKey, saveDesignPlacements, loadDesignPlacements } from "@core/utils/storage";
import type { Annotation } from "@core/types";

const note: Annotation = {
  id: "product-test",
  x: 40,
  y: 100,
  timestamp: Date.now(),
  comment: "Make this clear",
  element: "button",
  elementPath: "button",
  sourceFile: "src/Checkout.tsx:12:3",
  cssClasses: "checkout primary",
  attributes: { "data-qa": "checkout" },
};
const root = () =>
  within(document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement);
const clipboard = vi.fn().mockResolvedValue(undefined);
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([note]));
  vi.stubGlobal("navigator", { clipboard: { writeText: clipboard }, userAgent: "test" });
  clipboard.mockClear();
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function open(props: AgentationProps = {}) {
  const view = await render(<PageFeedbackToolbarCSS {...props} />);
  await fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
  return view;
}

function holdExit(element: Element) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  Object.defineProperty(element, "getAnimations", { configurable: true, value: () => [{ finished }] });
  return finish;
}

describe("clear batches", () => {
  it("bounds a large batch, follows its exits, and preserves a new note", async () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({ ...note, id: `batch-${i}` }));
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify(notes));
    const onClear = vi.fn();
    const target = document.createElement("p");
    target.textContent = "New feedback during clear";
    document.body.append(target);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try {
      await open({ onAnnotationsClear: onClear });
      const markers = root().getAllByRole("button", { name: /^Edit annotation/ });
      const finishes = markers.map(holdExit);
      await fireEvent.click(root().getByRole("button", { name: "Clear all" }));
      expect(onClear).toHaveBeenCalledOnce();
      expect(onClear.mock.calls[0][0]).toHaveLength(100);
      expect(Math.max(...markers.map(m => parseFloat(m.style.animationDelay)))).toBe(120);
      await fireEvent.click(root().getByRole("button", { name: "Clear all" }));
      expect(onClear).toHaveBeenCalledOnce();
      await act(async () => finishes[0]());
      expect(root().getAllByRole("button", { name: /^Edit annotation/ })).toHaveLength(100);
      await fireEvent.click(target, { clientX: 100, clientY: 100 });
      await fireEvent.input(root().getByPlaceholderText("What should change?"), { target: { value: "Keep this new note" } });
      await fireEvent.click(root().getByRole("button", { name: "Add" }));
      await act(async () => {});
      expect(JSON.parse(localStorage.getItem(getStorageKey(window.location.pathname))!)).toEqual([
        expect.objectContaining({ comment: "Keep this new note" }),
      ]);
      await act(async () => finishes.forEach(finish => finish()));
      expect(root().getAllByRole("button", { name: /^Edit annotation/ })).toHaveLength(1);
      await fireEvent.click(root().getByRole("button", { name: /^Edit annotation 1:/ }));
      expect(root().getByDisplayValue("Keep this new note")).toBeTruthy();
    } finally {
      document.elementFromPoint = original;
      target.remove();
    }
  });

  it("completes clearing hidden markers without waiting for an animation", async () => {
    await open();
    await fireEvent.click(root().getByRole("button", { name: "Hide markers" }));
    await fireEvent.click(root().getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(root().getByRole("button", { name: "Clear all" }).hasAttribute("disabled")).toBe(true));
    expect(localStorage.getItem(getStorageKey(window.location.pathname))).toBeNull();
  });

  it("preserves a layout edit made while the copied snapshot is pending", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ autoClearAfterCopy: true }));
    saveDesignPlacements(window.location.pathname, [{ id: "layout", type: "text", x: 30, y: 60, width: 100, height: 30, timestamp: Date.now() }]);
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    let finishCopy!: () => void;
    clipboard.mockImplementationOnce(() => new Promise<void>(resolve => { finishCopy = resolve; }));
    const onClear = vi.fn();
    await open({ onAnnotationsClear: onClear });
    await fireEvent.click(root().getByRole("button", { name: "Layout mode" }));
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    await fireEvent.click(shadow.querySelector('[aria-label="Copy feedback"]')!);
    await fireEvent.doubleClick(shadow.querySelector('[data-design-placement="layout"]')!);
    await fireEvent.input(root().getByPlaceholderText("Label or content text"), { target: { value: "Keep the layout edit" } });
    await fireEvent.click(root().getByRole("button", { name: "Set" }));
    expect(loadDesignPlacements<{ text: string }>(window.location.pathname)[0].text).toBe("Keep the layout edit");
    await act(async () => finishCopy());
    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
    await act(() => new Promise(resolve => setTimeout(resolve, 250)));
    expect(loadDesignPlacements<{ text: string }>(window.location.pathname)[0].text).toBe("Keep the layout edit");
    expect(localStorage.getItem(getStorageKey(window.location.pathname))).toBeNull();
  });

  it("clears a note whose ID the server replaced while the copy was pending", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ autoClearAfterCopy: true }));
    let finishUpload!: (value: unknown) => void;
    const uploading = new Promise(resolve => { finishUpload = resolve; });
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/sessions/session/annotations") && options?.method === "POST") return uploading;
      return Promise.resolve({ ok: true, json: async () => (url.endsWith("/health") ? {} : { id: "session", annotations: [] }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", class extends EventTarget { close() {} });
    const onClear = vi.fn();
    await render(<PageFeedbackToolbarCSS endpoint="http://swap.test" sessionId="session" onAnnotationsClear={onClear} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://swap.test/sessions/session/annotations", expect.objectContaining({ method: "POST" })));
    await fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
    await fireEvent.click(root().getByRole("button", { name: "Copy feedback" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalled());
    // The server assigns a new ID inside the auto-clear window, recreating the note object.
    await act(async () => finishUpload({ ok: true, json: async () => ({ ...note, id: "server-note", sessionId: "session" }) }));
    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
    expect(onClear.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "server-note", comment: note.comment })]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/annotations\/server-note$/), expect.objectContaining({ method: "DELETE" })));
  });

  it("ignores an older copy result after a newer copy succeeds", async () => {
    let failFirst!: (error: Error) => void;
    clipboard.mockImplementationOnce(() => new Promise((_, reject) => { failFirst = reject; }));
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    await open();
    const copy = root().getByRole("button", { name: "Copy feedback" });
    await fireEvent.click(copy);
    await fireEvent.click(copy);
    await waitFor(() => expect(copy.getAttribute("data-active")).toBe("true"));
    await act(async () => failFirst(new Error("old request failed")));
    expect(copy.getAttribute("data-active")).toBe("true");
  });
});

describe("host integration options", () => {
  it.each([false, true])("keeps the pending circle through Add, including an unfinished entrance (%s)", async (entranceFinished) => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({ ...note, id: `existing-${i}` })),
    ));
    const target = document.createElement("p");
    target.textContent = "New marker target";
    document.body.append(target);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try {
      await open();
      await fireEvent.click(target, { clientX: 100, clientY: 100 });
      const pending = root().getByRole("button", { name: "Pending annotation" });
      if (entranceFinished) await fireEvent.animationEnd(pending, { animationName: "markerIn" });
      await fireEvent.input(root().getByPlaceholderText("What should change?"), { target: { value: "New note" } });
      const popup = document.querySelector("agentation-toolbar")!.shadowRoot!.querySelector("[data-annotation-popup]")!;
      const finishPopupExit = holdExit(popup);
      await fireEvent.click(root().getByRole("button", { name: "Add" }));
      const markers = document.querySelector("agentation-toolbar")!.shadowRoot!.querySelectorAll<HTMLElement>("button[data-annotation-marker]");
      const marker = markers[markers.length - 1];
      expect(marker).toBe(pending);
      expect(markers).toHaveLength(9);
      expect(marker.hasAttribute("data-annotation-pending")).toBe(false);
      expect(marker.hasAttribute("disabled")).toBe(false);
      await act(() => new Promise(resolve => setTimeout(resolve, 180)));
      expect(popup.isConnected).toBe(true);
      await act(async () => finishPopupExit());
      expect(popup.isConnected).toBe(false);
      expect(marker.style.animationDelay).toBe("0ms");
      expect(marker.className).toContain(entranceFinished ? "confirm" : "enter");
      await fireEvent.animationEnd(marker, { animationName: entranceFinished ? "markerConfirm" : "markerIn" });
      expect(marker.className).not.toMatch(/enter|confirm/);
      await fireEvent.click(marker);
      expect(root().getByDisplayValue("New note")).toBeTruthy();
    } finally {
      document.elementFromPoint = original;
      target.remove();
    }
  });

  it.each(["edit click", "edit context menu", "delete click"])("protects an open editor from another marker's %s", async (action) => {
    const deleting = action !== "edit click";
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ markerClickBehavior: deleting ? "delete" : "edit" }));
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "Second target", comment: "Second saved comment", x: 70, y: 250 },
    ]));
    const onDelete = vi.fn();
    await open({ onAnnotationDelete: onDelete });
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    const [first, second] = [...shadow.querySelectorAll<HTMLElement>("[data-annotation-marker]")];
    const edit = async (marker: HTMLElement) => deleting ? await fireEvent.contextMenu(marker) : await fireEvent.click(marker);
    await edit(first);
    const card = shadow.querySelector<HTMLElement>("[data-annotation-card]")!;
    const input = root().getByPlaceholderText("Edit your feedback...") as HTMLTextAreaElement;
    const position = [card.style.left, card.style.top];
    for (const text of [note.comment, "Keep my unsaved edit"]) {
      await fireEvent.input(input, { target: { value: text } });
      await fireEvent.mouseOver(second);
      if (action === "edit context menu") await fireEvent.contextMenu(second);
      else await fireEvent.click(second);
      expect(root().getByPlaceholderText("Edit your feedback...")).toBe(input);
      expect(input.value).toBe(text);
      expect(shadow.activeElement).toBe(input);
      expect([card.style.left, card.style.top]).toEqual(position);
      expect(card.dataset.state).toBe("edit");
      expect(onDelete).not.toHaveBeenCalled();
    }
    await fireEvent.click(root().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(root().queryByRole("textbox")).toBeNull());
    const saved = JSON.parse(localStorage.getItem(getStorageKey(window.location.pathname))!);
    expect(saved.map((item: Annotation) => item.comment)).toEqual(["Keep my unsaved edit", "Second saved comment"]);
    await edit(second);
    expect(root().getByPlaceholderText("Edit your feedback...")).toHaveProperty("value", "Second saved comment");
  });

  it.each(["", "   ", "Keep this draft"])("handles an existing marker while a new draft contains %j", async (draft) => {
    const target = document.createElement("p");
    target.textContent = "New annotation target";
    document.body.append(target);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    const onAdd = vi.fn();
    try {
      await open({ onAnnotationAdd: onAdd });
      await fireEvent.click(target, { clientX: 100, clientY: 100 });
      const input = root().getByPlaceholderText("What should change?");
      await fireEvent.input(input, { target: { value: draft } });
      await fireEvent.click(root().getByRole("button", { name: "Edit annotation 1: button" }));
      if (draft.trim()) {
        expect(root().queryByPlaceholderText("Edit your feedback...")).toBeNull();
        expect(input).toHaveProperty("value", draft);
        expect(root().getByRole("button", { name: "Pending annotation" })).toBeTruthy();
      } else {
        const editor = root().getByPlaceholderText("Edit your feedback...");
        expect(editor).toHaveProperty("value", note.comment);
        await waitFor(() => expect(root().queryByPlaceholderText("What should change?")).toBeNull());
        await act(() => new Promise(resolve => setTimeout(resolve, 60)));
        expect(editor.getRootNode()).toHaveProperty("activeElement", editor);
        expect(root().queryByRole("button", { name: "Pending annotation" })).toBeNull();
      }
      expect(onAdd).not.toHaveBeenCalled();
    } finally {
      document.elementFromPoint = original;
      target.remove();
    }
  });

  it.each(["new", "existing"])("can select a new target while a %s annotation is closing", async (kind) => {
    const target = document.createElement("p");
    target.textContent = "Next annotation target";
    document.body.append(target);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try {
      await open();
      if (kind === "existing") {
        await fireEvent.click(root().getByRole("button", { name: "Edit annotation 1: button" }));
      } else {
        await fireEvent.click(target, { clientX: 100, clientY: 100 });
      }
      const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
      const previous = shadow.querySelector("[data-annotation-popup]")!;
      const finishExit = holdExit(previous);
      await fireEvent.click(root().getByRole("button", { name: "Cancel" }));
      await fireEvent.click(target, { clientX: 200, clientY: 200 });
      const draft = root().getByPlaceholderText("What should change?");
      expect(draft.closest("[data-annotation-popup]")).not.toBe(previous);
      await fireEvent.input(draft, { target: { value: "Keep the next draft" } });
      await act(async () => finishExit());
      await act(() => new Promise(resolve => setTimeout(resolve, 60)));
      expect(draft.isConnected).toBe(true);
      expect(draft).toHaveProperty("value", "Keep the next draft");
      expect(shadow.activeElement).toBe(draft);
      expect(root().getByRole("button", { name: "Pending annotation" })).toBeTruthy();
    } finally {
      document.elementFromPoint = original;
      target.remove();
    }
  });

  it("keeps the newly hovered marker active when the previous marker loses focus", async () => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "second target", comment: "Second note" },
    ]));
    await open();
    const first = root().getByRole("button", { name: "Edit annotation 1: button" });
    const second = root().getByRole("button", { name: "Edit annotation 2: second target" });
    const number = second.firstElementChild;
    const icon = second.querySelector("svg");
    await fireEvent.focus(first);
    await fireEvent.mouseOver(second);
    await fireEvent.mouseDown(second);
    await fireEvent.blur(first);
    await fireEvent.focus(second);
    expect(second.className).toContain("previewVisible");
    expect(second.className).toContain("actionVisible");
    expect(second.firstElementChild).toBe(number);
    expect(second.querySelector("svg")).toBe(icon);
    await fireEvent.mouseUp(second);
    await fireEvent.click(second);
    expect(root().getByDisplayValue("Second note")).toBeTruthy();
  });

  it("renumbers remaining markers when deletion finishes, with the number animation", async () => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "second target" },
      { ...note, id: "third-note", element: "third target" },
    ]));
    await open();
    const remaining = root().getByRole("button", { name: "Edit annotation 2: second target" });
    // jsdom has no CSS animations, so exits finish on the next microtask. Hold
    // the exit so the number can be checked before it finishes.
    const finish = holdExit(root().getByRole("button", { name: "Edit annotation 1: button" }));
    await fireEvent.click(root().getByRole("button", { name: "Edit annotation 1: button" }));
    await fireEvent.click(root().getByRole("button", { name: "Delete annotation" }));
    expect(remaining.firstElementChild?.textContent).toBe("2");
    await act(async () => finish());
    await waitFor(() => {
      expect(remaining.firstElementChild?.textContent).toBe("1");
      expect(remaining.firstElementChild?.className).toContain("renumber");
    });
  });

  it("keeps the roll animation when two markers are deleted before either exit finishes", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ markerClickBehavior: "delete" }));
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "second target" },
      { ...note, id: "third-note", element: "third target" },
    ]));
    await open();
    const first = root().getByRole("button", { name: "Delete annotation 1: button" });
    const second = root().getByRole("button", { name: "Delete annotation 2: second target" });
    const last = root().getByRole("button", { name: "Delete annotation 3: third target" });
    const finishFirst = holdExit(first);
    const finishSecond = holdExit(second);
    await fireEvent.click(first);
    await fireEvent.click(second);
    expect(last.firstElementChild?.textContent).toBe("3");
    await act(async () => { finishFirst(); finishSecond(); });
    await waitFor(() => {
      expect(last.firstElementChild?.textContent).toBe("1");
      expect(last.firstElementChild?.className).toContain("renumber");
    });
  });

  it("keeps the same marker, colour and number until its deletion animation completes", async () => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "second target" },
    ]));
    const onDelete = vi.fn();
    await open({ onAnnotationDelete: onDelete });
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    const remaining = root().getByRole("button", { name: "Edit annotation 2: second target" });
    const finish = holdExit(marker);
    const color = marker.style.backgroundColor;
    await fireEvent.click(marker);
    await fireEvent.click(root().getByRole("button", { name: "Delete annotation" }));
    await act(() => new Promise(resolve => setTimeout(resolve, 220)));
    expect(marker.isConnected).toBe(true);
    expect(marker.style.backgroundColor).toBe(color);
    expect(marker.className).not.toContain("actionVisible");
    expect(marker.firstElementChild?.textContent).toBe("1");
    expect(remaining.firstElementChild?.textContent).toBe("2");
    expect(marker.hasAttribute("disabled")).toBe(true);
    expect(marker.style.animationDelay).toBe("0ms");
    expect(onDelete).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(marker.isConnected).toBe(false);
    expect(remaining.firstElementChild?.textContent).toBe("1");
    expect(remaining.firstElementChild?.className).toContain("renumber");
  });

  it("handles out-of-order deletion completions without removing another note", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ markerClickBehavior: "delete" }));
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", element: "second target" },
      { ...note, id: "third-note", element: "third target" },
    ]));
    await open();
    const first = root().getByRole("button", { name: "Delete annotation 1: button" });
    const second = root().getByRole("button", { name: "Delete annotation 2: second target" });
    const third = root().getByRole("button", { name: "Delete annotation 3: third target" });
    const finishFirst = holdExit(first), finishSecond = holdExit(second);
    await fireEvent.click(first);
    await fireEvent.click(second);
    await act(async () => finishSecond());
    expect(first.isConnected).toBe(true);
    expect(third.firstElementChild?.textContent).toBe("2");
    await act(async () => finishFirst());
    expect(third.firstElementChild?.textContent).toBe("1");
    expect(third.firstElementChild?.className).toContain("renumber");
  });

  it("waits for Cancel's actual exit and returns focus without a second close timer", async () => {
    await open();
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    await fireEvent.click(marker);
    const popup = document.querySelector("agentation-toolbar")!.shadowRoot!.querySelector("[data-annotation-popup]")!;
    const finish = holdExit(popup);
    await fireEvent.click(root().getByRole("button", { name: "Cancel" }));
    await act(() => new Promise(resolve => setTimeout(resolve, 330)));
    expect(popup.isConnected).toBe(true);
    await act(async () => finish());
    expect(popup.hasAttribute("data-annotation-popup")).toBe(false);
    expect(document.querySelector("agentation-toolbar")!.shadowRoot!.activeElement).toBe(marker);
  });

  it("shows the marker edit action on entry from a React host element before any click", async () => {
    const view = await render(<><button>Host target</button><PageFeedbackToolbarCSS /></>);
    await fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
    const hostElement = view.getByText("Host target");
    const toolbarHost = document.querySelector("agentation-toolbar")!;
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    // Across a shadow boundary, the host's mouseout sees the custom element,
    // while mouseover inside the shadow tree still sees the actual marker.
    await fireEvent.mouseOut(hostElement, { relatedTarget: toolbarHost });
    await fireEvent.mouseOver(marker, { relatedTarget: hostElement });
    expect(marker.querySelector("svg")).not.toBeNull();
    expect(root().getByDisplayValue("Make this clear")).toBeTruthy();
    expect(root().queryByRole("textbox")).toBeNull();
    await fireEvent.click(marker);
    expect(root().getByPlaceholderText("Edit your feedback...")).toBeTruthy();
  });

  it("retains the preview during hover exit and reverses on re-entry", async () => {
    await open();
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    await fireEvent.mouseOver(marker);
    const preview = document.querySelector("agentation-toolbar")!.shadowRoot!.querySelector<HTMLElement>("[data-annotation-card]")!;
    expect(preview.querySelector("textarea")!.value).toBe("Make this clear");
    expect(preview.dataset.state).toBe("preview");
    await fireEvent.mouseOut(marker, { relatedTarget: document.body });
    expect(preview.isConnected).toBe(true);
    expect(preview.dataset.state).toBe("hidden");
    await fireEvent.mouseOver(marker);
    expect(document.querySelector("agentation-toolbar")!.shadowRoot!.querySelector("[data-annotation-card]")).toBe(preview);
    expect(preview.dataset.state).toBe("preview");
    await fireEvent.click(marker);
    expect(preview.dataset.state).toBe("edit");
  });

  it("keeps the same card on edit and reversal, with immediate typing focus", async () => {
    await open();
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    await fireEvent.mouseOver(marker);
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    const card = shadow.querySelector<HTMLElement>("[data-annotation-card]")!;
    const sharedInput = card.querySelector("textarea")!;
    const sharedHeading = card.querySelector("[data-editor-heading] span")!;
    expect(sharedInput.readOnly).toBe(true);
    const finishOldExit = holdExit(card);
    await fireEvent.click(marker);
    expect(card.querySelector("textarea")).toBe(sharedInput);
    expect(card.querySelector("[data-editor-heading] span")).toBe(sharedHeading);
    expect(sharedInput.readOnly).toBe(false);
    expect(card.querySelectorAll("textarea")).toHaveLength(1);
    const input = root().getByPlaceholderText("Edit your feedback...");
    expect(shadow.activeElement).toBe(input);
    expect(shadow.querySelector("[data-annotation-popup]")).toBe(card);
    await fireEvent.input(input, { target: { value: "Keep typing during reversal" } });
    await fireEvent.keyDown(input, { key: "Escape" });
    await fireEvent.click(marker);
    await act(async () => finishOldExit());
    expect(shadow.querySelector("[data-annotation-popup]")).toBe(card);
    expect(root().getByPlaceholderText("Edit your feedback...")).toBe(input);
    expect((input as HTMLTextAreaElement).value).toBe("Keep typing during reversal");
    expect(shadow.activeElement).toBe(input);
  });

  it("returns to the saved preview after keyboard Save without duplicating the editor", async () => {
    await open();
    const marker = root().getByRole("button", { name: "Edit annotation 1: button" });
    const originalMatches = marker.matches.bind(marker);
    vi.spyOn(marker, "matches").mockImplementation(selector => selector === ":focus-visible" || originalMatches(selector));
    await fireEvent.focus(marker);
    await fireEvent.click(marker);
    await fireEvent.input(root().getByPlaceholderText("Edit your feedback..."), { target: { value: "Saved updated note" } });
    await fireEvent.click(root().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(root().queryByRole("textbox")).toBeNull());
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    expect(shadow.querySelectorAll("[data-annotation-card]")).toHaveLength(1);
    expect(shadow.querySelector<HTMLElement>("[data-annotation-card]")!.dataset.state).toBe("preview");
    expect(root().getByDisplayValue("Saved updated note")).toBeTruthy();
    await waitFor(() => expect(shadow.activeElement).toBe(marker));
  });

  it("names saved marker and delete controls, restores focus and preserves other notes", async () => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      note, { ...note, id: "second-note", comment: "Keep this note" },
    ]));
    const onDelete = vi.fn();
    await open({ onAnnotationDelete: onDelete });
    const marker = document.querySelector("agentation-toolbar")!.shadowRoot!.querySelector<HTMLElement>("[data-annotation-marker]")!;
    expect(marker.tagName).toBe("BUTTON");
    expect(marker.getAttribute("aria-label")).toBe("Edit annotation 1: button");
    marker.focus();
    await fireEvent.click(marker);
    expect(root().getByRole("button", { name: "Delete annotation" })).toBeTruthy();
    await fireEvent.click(root().getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(root().queryByRole("textbox")).toBeNull());
    expect(document.querySelector("agentation-toolbar")!.shadowRoot!.activeElement).toBe(marker);
    await fireEvent.click(marker);
    await fireEvent.click(root().getByRole("button", { name: "Delete annotation" }));
    await waitFor(() => expect(root().queryByRole("textbox")).toBeNull());
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: note.id })));
    expect(JSON.parse(localStorage.getItem(getStorageKey(window.location.pathname))!).map((a: Annotation) => a.id)).toEqual(["second-note"]);
    expect(document.querySelector("agentation-toolbar")!.shadowRoot!.activeElement).toBe(root().getByRole("button", { name: "Exit" }));
  });

  it("keeps marker numbers and the saved count stable when a frame note scrolls out of view", async () => {
    const frame = document.createElement("iframe");
    frame.id = "numbering-preview";
    document.body.append(frame);
    const child = frame.contentDocument!;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 150));
    Object.defineProperties(frame, {
      offsetWidth: { value: 200 },
      offsetHeight: { value: 150 },
      clientWidth: { value: 200 },
      clientHeight: { value: 150 },
    });
    let childScroll = 0;
    Object.defineProperty(child.defaultView!, "scrollY", { get: () => childScroll });
    const frameNote: Annotation = {
      ...note,
      id: "frame-note",
      frame: {
        path: [{ index: 0, id: frame.id, url: child.URL }],
        x: 40,
        y: 50,
        fixed: false,
        boundingBox: { x: 20, y: 30, width: 80, height: 40 },
      },
    };
    localStorage.setItem(
      getStorageKey(window.location.pathname),
      JSON.stringify([note, frameNote, { ...note, id: "last-note", comment: "Last note" }]),
    );
    const markers = () =>
      [
        ...document
          .querySelector("agentation-toolbar")!
          .shadowRoot!.querySelectorAll("[data-annotation-marker]"),
      ].map((marker) => marker.firstElementChild?.textContent);
    try {
      await open();
      expect(markers()).toEqual(["1", "2", "3"]);
      childScroll = 100;
      await fireEvent.scroll(child);
      expect(markers()).toEqual(["1", "3"]);
      expect(root().getByRole("button", { name: "Exit" }).textContent).toBe("3");
      childScroll = 0;
      await fireEvent.scroll(child);
      expect(markers()).toEqual(["1", "2", "3"]);
      expect(root().getByRole("button", { name: "Exit" }).textContent).toBe("3");
      expect(
        JSON.parse(localStorage.getItem(getStorageKey(window.location.pathname))!),
      ).toHaveLength(3);
    } finally {
      await act(async () => { frame.remove(); });
    }
  });

  it("captures an explicitly requested attribute and allows selecting it without a comment", async () => {
    const target = document.createElement("button");
    target.setAttribute("data-object-id", "cart-42");
    target.textContent = "Cart";
    document.body.append(target);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    const added = vi.fn();
    try {
      await open({ copyFormat: { attribute: "data-object-id" }, onAnnotationAdd: added });
      await fireEvent.click(target, { clientX: 100, clientY: 100 });
      expect(root().getByPlaceholderText("Add a note (optional)")).toBeTruthy();
      await fireEvent.click(root().getByRole("button", { name: "Add" }));
      expect(added).toHaveBeenCalledWith(
        expect.objectContaining({ comment: "", attributes: { "data-object-id": "cart-42" } }),
      );
      await fireEvent.click(root().getByRole("button", { name: /^Copy / }));
      await waitFor(() => expect(clipboard).toHaveBeenCalledWith("cart-42"));
    } finally {
      document.elementFromPoint = original;
      target.remove();
    }
  });

  it("moves the portal without discarding an open feedback draft", async () => {
    const first = document.createElement("section"),
      second = document.createElement("section");
    document.body.append(first, second);
    try {
      const view = await open({ portalContainer: first });
      await fireEvent.click(
        first
          .querySelector("agentation-toolbar")!
          .shadowRoot!.querySelector("[data-annotation-marker]")!,
      );
      const textarea = root().getByPlaceholderText("Edit your feedback...");
      await fireEvent.input(textarea, { target: { value: "Unsent draft" } });
      await view.rerender(<PageFeedbackToolbarCSS portalContainer={second} />);
      expect(second.querySelector("agentation-toolbar")).toBeTruthy();
      expect(first.querySelector("agentation-toolbar")).toBeNull();
      expect(root().getByPlaceholderText("Edit your feedback...")).toBe(textarea);
      expect((textarea as HTMLTextAreaElement).value).toBe("Unsent draft");
      await view.unmount();
      expect(second.children).toHaveLength(0);
    } finally {
      first.remove();
      second.remove();
    }
  });

  it("consumes feedback Escape before a host modal's document listener", async () => {
    const container = document.createElement("section");
    document.body.append(container);
    const hostDismiss = vi.fn();
    document.addEventListener("keydown", hostDismiss);
    try {
      await open({ portalContainer: container });
      await fireEvent.keyDown(root().getByRole("button", { name: "Exit" }), { key: "Escape" });
      expect(root().getByRole("button", { name: "Start feedback mode" })).toBeTruthy();
      expect(hostDismiss).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", hostDismiss);
      container.remove();
    }
  });

  it("identifies the app in Copy and Send, including prop updates", async () => {
    const submit = vi.fn();
    const view = await open({ appName: "Shop", onSubmit: submit });
    await fireEvent.click(root().getByRole("button", { name: /^Copy / }));
    await waitFor(() =>
      expect(clipboard).toHaveBeenCalledWith(expect.stringContaining("**App:** Shop")),
    );
    await view.rerender(<PageFeedbackToolbarCSS appName="Admin" onSubmit={submit} />);
    await fireEvent.click(root().getByRole("button", { name: "Send Annotations" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.stringContaining("**App:** Admin"),
        expect.any(Array),
      ),
    );
  });

  it("dismisses the feedback popup from Cancel without dismissing its host modal", async () => {
    const container = document.createElement("section");
    document.body.append(container);
    const hostDismiss = vi.fn();
    document.addEventListener("keydown", hostDismiss);
    try {
      await open({ portalContainer: container });
      await fireEvent.click(
        container
          .querySelector("agentation-toolbar")!
          .shadowRoot!.querySelector("[data-annotation-marker]")!,
      );
      await fireEvent.keyDown(root().getByText("Cancel", { selector: "button" }), { key: "Escape" });
      expect(hostDismiss).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(root().queryByRole("textbox")).toBeNull(),
      );
      expect(
        container
          .querySelector("agentation-toolbar")!
          .shadowRoot!.querySelector('button[aria-label="Exit"]'),
      ).toBeTruthy();
    } finally {
      document.removeEventListener("keydown", hostDismiss);
      container.remove();
    }
  });

  it.each([
    ["source", "src/Checkout.tsx:12:3"],
    ["classes", "checkout primary"],
    [{ attribute: "data-qa" }, "checkout"],
  ] as const)("copies the requested %j metadata", async (copyFormat, output) => {
    await open({ copyFormat });
    await fireEvent.click(root().getByRole("button", { name: /^Copy / }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(output));
  });

  it("does not clear notes or overwrite the clipboard when the requested attribute is absent", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ autoClearAfterCopy: true }));
    const onCopy = vi.fn();
    await open({ copyFormat: { attribute: "data-missing" }, onCopy });
    await fireEvent.click(root().getByRole("button", { name: /^Copy / }));
    expect(clipboard).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(getStorageKey(window.location.pathname))!)).toHaveLength(
      1,
    );
  });

  it("formats only Copy while preserving structured Send output", async () => {
    const submit = vi.fn();
    await open({ copyFormat: "source", onSubmit: submit });
    await fireEvent.click(root().getByRole("button", { name: /^Copy / }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(note.sourceFile));
    await fireEvent.click(root().getByRole("button", { name: "Send Annotations" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.stringContaining("## Page Feedback:"),
        expect.any(Array),
      ),
    );
  });

  it("can disable and re-enable shortcuts without disabling toolbar buttons", async () => {
    const view = await open({ enableKeyboardShortcuts: false });
    await fireEvent.keyDown(document, { key: "l" });
    expect(root().getByRole("button", { name: "Layout mode" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(root().getByRole("button", { name: "Exit" })).toBeTruthy();
    await fireEvent.click(root().getByRole("button", { name: "Exit" }));
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    expect(root().getByRole("button", { name: "Start feedback mode" })).toBeTruthy();
    await view.rerender(<PageFeedbackToolbarCSS enableKeyboardShortcuts />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    expect(root().getByRole("button", { name: "Exit" })).toBeTruthy();
  });

  it("opens the saved source through the host's editor integration", async () => {
    const onOpenSource = vi.fn();
    await open({ onOpenSource });
    const marker = document
      .querySelector("agentation-toolbar")!
      .shadowRoot!.querySelector("[data-annotation-marker]")!;
    await fireEvent.click(marker);
    await fireEvent.click(await root().findByRole("button", { name: "Open in editor" }));
    expect(onOpenSource).toHaveBeenCalledWith(note.sourceFile);
  });
});
