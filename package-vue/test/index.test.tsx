import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "./test-utils";
import { PageFeedbackToolbarCSS } from "../src";
import type { Annotation } from "@agentation/core/types";
import type { AgentationProps } from "../src";
import { getStorageKey } from "@agentation/core/utils/storage";

function toolbarRoot() {
  return document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement;
}

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
const originalElementFromPoint = document.elementFromPoint;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("navigator", {
    clipboard: mockClipboard,
    userAgent: "test-agent",
  });
  mockClipboard.writeText.mockClear();
});

afterEach(async () => {
  document.elementFromPoint = originalElementFromPoint;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PageFeedbackToolbarCSS", () => {
  describe("onAnnotationAdd callback", () => {
    it("should accept onAnnotationAdd prop without errors", async () => {
      const handleAnnotation = vi.fn();
      await expect(
        render(<PageFeedbackToolbarCSS onAnnotationAdd={handleAnnotation} />)
      ).resolves.toBeDefined();
    });

    it("should type-check annotation callback parameter", async () => {
      // This test verifies TypeScript types are correct at compile time
      const handleAnnotation = (annotation: Annotation) => {
        // Verify all expected properties are accessible
        expect(annotation).toHaveProperty("id");
        expect(annotation).toHaveProperty("x");
        expect(annotation).toHaveProperty("y");
        expect(annotation).toHaveProperty("comment");
        expect(annotation).toHaveProperty("element");
        expect(annotation).toHaveProperty("elementPath");
        expect(annotation).toHaveProperty("timestamp");
      };

      await render(<PageFeedbackToolbarCSS onAnnotationAdd={handleAnnotation} />);
    });
  });

  describe("copyToClipboard prop", () => {
    it("should default copyToClipboard to true", async () => {
      // Component should render without explicit copyToClipboard prop
      await expect( render(<PageFeedbackToolbarCSS />)).resolves.toBeDefined();
    });

    it("should accept copyToClipboard={false} without errors", async () => {
      await expect(
        render(<PageFeedbackToolbarCSS copyToClipboard={false} />)
      ).resolves.toBeDefined();
    });

    it("should accept copyToClipboard={true} without errors", async () => {
      await expect(
        render(<PageFeedbackToolbarCSS copyToClipboard={true} />)
      ).resolves.toBeDefined();
    });
  });

  describe("combined props", () => {
    it("should accept both onAnnotationAdd and copyToClipboard props", async () => {
      const handleAnnotation = vi.fn();
      await expect(
        render(
          <PageFeedbackToolbarCSS
            onAnnotationAdd={handleAnnotation}
            copyToClipboard={false}
          />
        )
      ).resolves.toBeDefined();
    });
  });
});

describe("Annotation type", () => {
  it("should include all required fields", async () => {
    const annotation: Annotation = {
      id: "test-id",
      x: 50,
      y: 100,
      comment: "Test comment",
      element: "Button",
      elementPath: "body > div > button",
      timestamp: Date.now(),
    };

    expect(annotation.id).toBe("test-id");
    expect(annotation.x).toBe(50);
    expect(annotation.y).toBe(100);
    expect(annotation.comment).toBe("Test comment");
    expect(annotation.element).toBe("Button");
    expect(annotation.elementPath).toBe("body > div > button");
    expect(typeof annotation.timestamp).toBe("number");
  });

  it("should allow optional metadata fields", async () => {
    const annotation: Annotation = {
      id: "test-id",
      x: 50,
      y: 100,
      comment: "Test comment",
      element: "Button",
      elementPath: "body > div > button",
      timestamp: Date.now(),
      selectedText: "Selected text content",
      boundingBox: { x: 100, y: 200, width: 150, height: 40 },
      nearbyText: "Context around the element",
      cssClasses: "btn btn-primary",
      nearbyElements: "div, span, a",
      computedStyles: "color: blue; font-size: 14px",
      fullPath: "html > body > div#app > main > button.btn",
      accessibility: "role=button, aria-label=Submit",
      isMultiSelect: false,
      isFixed: false,
    };

    expect(annotation.selectedText).toBe("Selected text content");
    expect(annotation.boundingBox).toEqual({
      x: 100,
      y: 200,
      width: 150,
      height: 40,
    });
    expect(annotation.cssClasses).toBe("btn btn-primary");
    expect(annotation.fullPath).toBe("html > body > div#app > main > button.btn");
    expect(annotation.accessibility).toBe("role=button, aria-label=Submit");
    expect(annotation.isMultiSelect).toBe(false);
    expect(annotation.isFixed).toBe(false);
  });
});

describe("blockInteractions", () => {
  it("lets the host handle picked clicks when interaction blocking is disabled", async () => {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ blockInteractions: false }));
    const onClick = vi.fn();
    await render(<><div onClick={onClick}>Host target</div><PageFeedbackToolbarCSS /></>);
    const target = screen.getByText("Host target");
    document.elementFromPoint = () => target;
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    await fireEvent.click(target);
    expect(onClick).toHaveBeenCalledOnce();
    expect(toolbarRoot().querySelector("[data-annotation-popup]")).not.toBeNull();
  });

  it("does not let a picked click reach a delegated host handler", async () => {
    const onRowClick = vi.fn();
    await render(
      <>
        <table>
          <tbody>
            <tr onClick={onRowClick}>
              <td>Cell</td>
            </tr>
          </tbody>
        </table>
        <PageFeedbackToolbarCSS />
      </>
    );

    const cell = screen.getByText("Cell");
    // jsdom has no layout; resolve the picked element to the clicked cell
    document.elementFromPoint = () => cell;

    // Activate feedback mode (blockInteractions defaults to true)
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });

    await fireEvent.click(cell);

    expect(onRowClick).not.toHaveBeenCalled();
    expect(toolbarRoot().querySelector("[data-annotation-popup]")).not.toBeNull();
  });
});

describe("cmd+shift multi-select", () => {
  it("opens the popup on modifier release even when the keydowns were never observed", async () => {
    await render(
      <>
        <p>First</p>
        <p>Second</p>
        <PageFeedbackToolbarCSS />
      </>
    );
    const first = screen.getByText("First");
    const second = screen.getByText("Second");

    // Modifiers are already held when feedback mode is activated
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });

    document.elementFromPoint = () => first;
    await fireEvent.click(first, { metaKey: true, shiftKey: true });
    document.elementFromPoint = () => second;
    await fireEvent.click(second, { metaKey: true, shiftKey: true });

    expect(toolbarRoot().querySelector("[data-annotation-popup]")).toBeNull();

    await fireEvent.keyUp(document, { key: "Shift", metaKey: true });

    expect(toolbarRoot().querySelector("[data-annotation-popup]")).not.toBeNull();
  });
});

describe("keyboard shortcuts", () => {
  it("leaves single-key shortcuts to the host page while the toolbar is collapsed", async () => {
    // Layout mode mounts a palette that observes its size; jsdom has no ResizeObserver
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    await render(
      <>
        <div tabindex={0} data-testid="editor" />
        <PageFeedbackToolbarCSS />
      </>
    );
    const editor = screen.getByTestId("editor");

    // Collapsed: "l" is not intercepted (fireEvent returns false when defaultPrevented)
    expect(await fireEvent.keyDown(editor, { key: "l" })).toBe(true);

    // Active: the same key is now a toolbar shortcut
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    expect(await fireEvent.keyDown(editor, { key: "l" })).toBe(false);
  });
});

describe("layout mode interruptions", () => {
  it.each(["pointer", "keyboard"])("cancels overlay exit immediately when reopened by %s", async (input) => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    await render(<PageFeedbackToolbarCSS />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    const toggle = async () => input === "keyboard"
      ? await fireEvent.keyDown(document, { key: "l" })
      : await fireEvent.click(toolbarRoot().querySelector<HTMLButtonElement>('[aria-label="Layout mode"], [aria-label="Exit layout mode"]')!);
    await toggle();
    await toggle();
    expect(toolbarRoot().querySelector('[class*="overlayExiting"]')).not.toBeNull();
    await toggle();
    expect(toolbarRoot().querySelector('[aria-label="Exit layout mode"]')).not.toBeNull();
    expect(toolbarRoot().querySelector('[class*="overlayExiting"]')).toBeNull();
    await act(async () => {});
  });
});

describe("clipboard delivery", () => {
  const annotation: Annotation = {
    id: "copy-test", x: 50, y: 100, comment: "Keep this feedback until copied",
    element: "Button", elementPath: "body > button", timestamp: Date.now(),
  };

  async function setup(props: AgentationProps = {}) {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify({ autoClearAfterCopy: true }));
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([annotation]));
    await render(<PageFeedbackToolbarCSS {...props} />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    return within(toolbarRoot()).getByRole("button", { name: "Copy feedback" });
  }

  it("does not reload layout records as ordinary feedback markers", async () => {
    localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([
      annotation,
      { ...annotation, id: "placement", kind: "placement", comment: "Stored layout item" },
      { ...annotation, id: "rearrange", kind: "rearrange", comment: "Stored rearrange item" },
    ]));
    const onCopy = vi.fn();
    await render(<PageFeedbackToolbarCSS copyToClipboard={false} onCopy={onCopy} />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    await fireEvent.click(within(toolbarRoot()).getByRole("button", { name: "Copy feedback" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    expect(onCopy.mock.calls[0][0]).toContain(annotation.comment);
    expect(onCopy.mock.calls[0][0]).not.toContain("Stored layout item");
    expect(onCopy.mock.calls[0][0]).not.toContain("Stored rearrange item");
  });

  it("keeps feedback and does not show success when both copy methods fail", async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    const onCopy = vi.fn();
    const onAnnotationsClear = vi.fn();
    const copy = await setup({ onCopy, onAnnotationsClear });
    await fireEvent.click(copy);
    await waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    expect(onCopy.mock.calls[0][0]).toContain(annotation.comment);
    expect(copy.getAttribute("data-active")).toBe("false");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    expect(onAnnotationsClear).not.toHaveBeenCalled();
    expect(copy.hasAttribute("disabled")).toBe(false);
  });

  it("clears only after a successful fallback", async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => true) });
    const onAnnotationsClear = vi.fn();
    const copy = await setup({ onAnnotationsClear });
    await fireEvent.click(copy);
    await waitFor(() => expect(copy.getAttribute("data-active")).toBe("true"));
    await waitFor(() => expect(onAnnotationsClear).toHaveBeenCalledWith([annotation]));
  });

  it("preserves callback-only copying when clipboard access is disabled by the consumer", async () => {
    const onCopy = vi.fn();
    const copy = await setup({ copyToClipboard: false, onCopy });
    await fireEvent.click(copy);
    expect(onCopy).toHaveBeenCalledOnce();
    expect(mockClipboard.writeText).not.toHaveBeenCalled();
    expect(copy.getAttribute("data-active")).toBe("true");
  });
});

describe("manual submission", () => {
  const annotation: Annotation = {
    id: "submit-test", x: 50, y: 100, comment: "Make this easier to read",
    element: "Button", elementPath: "body > button", timestamp: Date.now(),
  };

  async function setup(
    props: AgentationProps = {},
    settings: Record<string, unknown> = {},
    hasFeedback = true,
  ) {
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify(settings));
    if (hasFeedback) {
      localStorage.setItem(getStorageKey(window.location.pathname), JSON.stringify([annotation]));
    }
    await render(<PageFeedbackToolbarCSS {...props} />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    return within(toolbarRoot()).getByText("Send Annotations").parentElement!.querySelector("button")!;
  }

  it("submits through the callback without making a webhook request", async () => {
    const onSubmit = vi.fn();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const send = await setup({ onSubmit });
    expect(send.disabled).toBe(false);
    expect(send.tabIndex).toBe(0);
    await fireEvent.click(send);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toContain(annotation.comment);
    expect(onSubmit.mock.calls[0][1]).toEqual([annotation]);
    await waitFor(() => expect(send.getAttribute("data-no-hover")).toBe("true"));
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the same callback-only delivery for the S shortcut", async () => {
    const onSubmit = vi.fn();
    await setup({ onSubmit });
    await fireEvent.keyDown(document, { key: "s" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });

  it.each([
    { label: "no destination", props: {}, settings: {}, canSend: false },
    { label: "manual prop webhook", props: { webhookUrl: "https://example.test/hook" }, settings: { webhooksEnabled: false }, canSend: true },
    { label: "manual settings webhook", props: {}, settings: { webhookUrl: "https://example.test/hook", webhooksEnabled: false }, canSend: true },
    { label: "auto-send webhook", props: { webhookUrl: "https://example.test/hook" }, settings: {}, canSend: false },
    { label: "callback with auto-send webhook", props: { webhookUrl: "https://example.test/hook", onSubmit: vi.fn() }, settings: {}, canSend: true },
  ])("exposes manual Send for $label only when usable", async ({ props, settings, canSend }) => {
    const send = await setup(props, settings);
    expect(send.disabled).toBe(!canSend);
    expect(send.tabIndex).toBe(canSend ? 0 : -1);
  });

  it("does not submit empty feedback", async () => {
    const onSubmit = vi.fn();
    const send = await setup({ onSubmit }, {}, false);
    expect(send.disabled).toBe(true);
    await fireEvent.keyDown(document, { key: "s" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not intercept S when only automatic webhook delivery is enabled", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await setup({ webhookUrl: "https://example.test/hook" });
    expect(await fireEvent.keyDown(document, { key: "s" })).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps the hidden Send control out of keyboard navigation", async () => {
    const send = await setup({ onSubmit: vi.fn() });
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    expect(send.tabIndex).toBe(-1);
  });

  it("clears feedback after successful callback delivery when requested", async () => {
    const onAnnotationsClear = vi.fn();
    const send = await setup({ onSubmit: vi.fn(), onAnnotationsClear }, { autoClearAfterCopy: true });
    await fireEvent.click(send);
    await waitFor(() => expect(onAnnotationsClear).toHaveBeenCalledWith([annotation]), { timeout: 2000 });
  });

  it("sends to both configured delivery mechanisms", async () => {
    const onSubmit = vi.fn();
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", request);
    const send = await setup({ onSubmit, webhookUrl: "https://example.test/hook" }, { webhooksEnabled: false });
    await fireEvent.click(send);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ event: "submit", annotations: [annotation] });
  });

  it("preserves feedback after a webhook failure", async () => {
    const onAnnotationsClear = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const send = await setup({ webhookUrl: "https://example.test/hook", onAnnotationsClear }, { webhooksEnabled: false, autoClearAfterCopy: true });
    await fireEvent.click(send);
    await waitFor(() => expect(send.getAttribute("data-no-hover")).toBe("true"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    expect(onAnnotationsClear).not.toHaveBeenCalled();
    expect(send.disabled).toBe(false);
  });

  it.each(["throws", "rejects"])("preserves feedback when the callback %s", async (failure) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onAnnotationsClear = vi.fn();
    const onSubmit = vi.fn(() => {
      if (failure === "throws") throw new Error("Delivery failed");
      return Promise.reject(new Error("Delivery failed"));
    });
    const send = await setup({ onSubmit, onAnnotationsClear }, { autoClearAfterCopy: true });
    await fireEvent.click(send);
    await waitFor(() => expect(send.getAttribute("data-no-hover")).toBe("true"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    expect(onAnnotationsClear).not.toHaveBeenCalled();
    expect(send.disabled).toBe(false);
  });

  it("waits for asynchronous callback delivery before reporting success", async () => {
    let complete!: () => void;
    const delivery = new Promise<void>(resolve => { complete = resolve; });
    const onSubmit = vi.fn(() => delivery);
    const send = await setup({ onSubmit });
    await fireEvent.click(send);
    expect(send.disabled).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(send.getAttribute("data-no-hover")).toBe("false");
    complete();
    await waitFor(() => expect(send.getAttribute("data-no-hover")).toBe("true"));
    expect(send.disabled).toBe(false);
  });
});

describe("shadow event boundaries", () => {
  it("keeps toolbar pointer events from dismissing host menus", async () => {
    const onOutside = vi.fn();
    document.addEventListener("mousedown", onOutside);
    const view = await render(<PageFeedbackToolbarCSS />);
    try {
      await fireEvent.mouseDown(toolbarRoot().querySelector('[data-feedback-toolbar]')!, { composed: true });
      expect(onOutside).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("mousedown", onOutside);
      await view.unmount();
    }
  });

  it("leaves typing inside a host web component alone", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    await render(<PageFeedbackToolbarCSS />);
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadow.append(input);
    try {
      await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
      expect(await fireEvent.keyDown(input, { key: "l", composed: true })).toBe(true);
    } finally {
      await act(async () => { host.remove(); });
    }
  });
});

describe("toolbar viewport bounds", () => {
  it("does not leave a drag armed when press and release precede effect setup", async () => {
    await render(<PageFeedbackToolbarCSS />);
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    const toggle = within(toolbarRoot()).getByRole("button", { name: "Start feedback mode" });
    await act(async () => {
      await fireEvent.mouseDown(toggle, { button: 0, buttons: 1, clientX: 500, clientY: 130, composed: true });
      await fireEvent.mouseUp(document.body);
    });
    const position = wrapper.style.cssText;
    await fireEvent.mouseMove(document.body, { buttons: 1, clientX: 600, clientY: 130 });
    expect(wrapper.style.cssText).toBe(position);
    expect(wrapper.hasAttribute("data-dragging")).toBe(false);
  });

  it("cancels a missed release instead of dragging on unpressed pointer movement", async () => {
    await render(<PageFeedbackToolbarCSS />);
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    const toggle = within(toolbarRoot()).getByRole("button", { name: "Start feedback mode" });
    await fireEvent.mouseDown(toggle, { button: 0, buttons: 1, clientX: 500, clientY: 130, composed: true });
    const position = wrapper.style.cssText;
    await fireEvent.mouseMove(document.body, { buttons: 0, clientX: 600, clientY: 130 });
    expect(wrapper.style.cssText).toBe(position);
    expect(wrapper.hasAttribute("data-dragging")).toBe(false);
    await fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it.each([true, false])("accepts the first new click after dragging (release click: %s)", async (releaseClick) => {
    await render(<PageFeedbackToolbarCSS />);
    document.elementFromPoint = () => null;
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    const surface = wrapper.querySelector<HTMLButtonElement>('[aria-label="Start feedback mode"]')!;
    await fireEvent.mouseDown(surface, { button: 0, clientX: 500, clientY: 130, composed: true });
    await fireEvent.mouseMove(document.body, { buttons: 1, clientX: 550, clientY: 130 });
    await fireEvent.mouseUp(document.body);
    if (releaseClick) await fireEvent.click(surface);
    expect(surface.disabled).toBe(false);

    await fireEvent.mouseDown(surface, { button: 0, clientX: 550, clientY: 130, composed: true });
    await fireEvent.mouseUp(surface);
    await fireEvent.click(surface);
    expect(surface.getAttribute("aria-expanded")).toBe("true");
  });

  it("starts a drag from the rendered position during an edge correction", async () => {
    localStorage.setItem("feedback-toolbar-position", JSON.stringify({ x: 200, y: 120 }));
    await render(<PageFeedbackToolbarCSS />);
    document.elementFromPoint = () => null;
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 120, left: 100, top: 120, right: 437, bottom: 164,
      width: 337, height: 44, toJSON: () => ({}),
    });
    await fireEvent.mouseDown(wrapper.firstElementChild!, {
      button: 0, clientX: 420, clientY: 130, composed: true,
    });
    await fireEvent.mouseMove(document.body, { buttons: 1, clientX: 440, clientY: 140 });
    expect(Number.parseFloat(wrapper.style.left)).toBe(120);
    expect(Number.parseFloat(wrapper.style.top)).toBe(130);
    await fireEvent.mouseUp(document.body);
  });

  it.each([
    { label: "standard controls", props: {}, settings: {}, surfaceWidth: 297 },
    { label: "callback Send", props: { onSubmit: vi.fn() }, settings: {}, surfaceWidth: 337 },
    { label: "manual webhook Send", props: { webhookUrl: "https://example.test/hook" }, settings: { webhooksEnabled: false }, surfaceWidth: 337 },
    { label: "automatic webhook", props: { webhookUrl: "https://example.test/hook" }, settings: {}, surfaceWidth: 297 },
  ])("keeps $label visible after expanding at the left edge and dragging", async ({ props, settings, surfaceWidth }) => {
    // The right-aligned 44px launcher is 20px from the left viewport edge.
    localStorage.setItem("feedback-toolbar-position", JSON.stringify({ x: -273, y: 120 }));
    localStorage.setItem("feedback-toolbar-settings", JSON.stringify(settings));
    await render(<PageFeedbackToolbarCSS {...props} />);
    document.elementFromPoint = () => null;
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    const surface = wrapper.firstElementChild!;
    const visibleLeft = () => Number.parseFloat(wrapper.style.left) + 337 - surfaceWidth;

    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    expect(visibleLeft()).toBe(20);

    await fireEvent.mouseDown(surface, { button: 0, clientX: 30, clientY: 130, composed: true });
    await fireEvent.mouseMove(document.body, { buttons: 1, clientX: -1000, clientY: 130 });
    await fireEvent.mouseUp(document.body);
    expect(visibleLeft()).toBe(20);

    await fireEvent.mouseDown(surface, { button: 0, clientX: 30, clientY: 130, composed: true });
    await fireEvent.mouseMove(document.body, { buttons: 1, clientX: 3000, clientY: 130 });
    await fireEvent.mouseUp(document.body);
    expect(Number.parseFloat(wrapper.style.left) + 337).toBe(window.innerWidth - 20);
  });

  it("rechecks the boundary when a Send destination is added while open", async () => {
    localStorage.setItem("feedback-toolbar-position", JSON.stringify({ x: -273, y: 120 }));
    const view = await render(<PageFeedbackToolbarCSS />);
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    await view.rerender(<PageFeedbackToolbarCSS onSubmit={vi.fn()} />);
    const wrapper = toolbarRoot().querySelector<HTMLElement>("[data-agentation-toolbar]")!;
    expect(Number.parseFloat(wrapper.style.left)).toBe(20);
  });
});


describe("keyboard and accessible controls", () => {
  it("exposes only the native launcher while collapsed", async () => {
    await render(<PageFeedbackToolbarCSS />);
    const buttons = within(toolbarRoot()).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].tagName).toBe("BUTTON");
    expect(buttons[0].getAttribute("aria-label")).toBe("Start feedback mode");
    expect(buttons[0].getAttribute("title")).toContain("Ctrl+Shift+F");
    expect(buttons[0].getAttribute("title")).toContain("⌘⇧F");
    expect(buttons[0].querySelector("button")).toBeNull();
    expect(toolbarRoot().querySelector('[aria-label="Feedback controls"]')!.hasAttribute("inert")).toBe(true);
    expect(toolbarRoot().querySelector('[data-agentation-settings-panel]')!.hasAttribute("inert")).toBe(true);
  });

  it("names the controls, focuses them on keyboard activation, and returns focus on Exit", async () => {
    await render(<PageFeedbackToolbarCSS onSubmit={() => {}} />);
    const ui = within(toolbarRoot());
    const launcher = ui.getByRole("button", { name: "Start feedback mode" });
    launcher.focus();
    await fireEvent.click(launcher, { detail: 0 });
    expect((toolbarRoot() as unknown as ShadowRoot).activeElement).toBe(ui.getByRole("button", { name: "Pause animations" }));
    for (const name of ["Pause animations", "Layout mode", "Hide markers", "Copy feedback", "Send Annotations", "Clear all", "Settings", "Exit"]) {
      expect(ui.getByRole("button", { name })).toBeTruthy();
    }
    await fireEvent.click(ui.getByRole("button", { name: "Exit" }));
    expect((toolbarRoot() as unknown as ShadowRoot).activeElement).toBe(launcher);
    expect(ui.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps the same toggle button and SVG through opening and closing", async () => {
    await render(<PageFeedbackToolbarCSS />);
    const ui = within(toolbarRoot());
    const toggle = ui.getByRole("button", { name: "Start feedback mode" }) as HTMLButtonElement;
    const icon = toggle.querySelector("svg");
    // No timer advance or animation completion between successive presses.
    for (let click = 0; click < 12; click++) {
      await fireEvent.click(toggle);
      const open = click % 2 === 0;
      expect(ui.getByRole("button", { name: open ? "Exit" : "Start feedback mode" })).toBe(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe(String(open));
      expect(toggle.querySelector("svg")).toBe(icon);
      expect(toggle.disabled).toBe(false);
    }
  });



  it("keeps inactive settings pages out of navigation and returns focus through Escape", async () => {
    await render(<PageFeedbackToolbarCSS />);
    // Avoid jsdom's :has/:checked selector bug on the existing switch styles.
    const button = (name: string) => toolbarRoot().querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    const activeElement = () => (toolbarRoot() as unknown as ShadowRoot).activeElement;
    await fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
    const settings = button("Settings");
    await fireEvent.click(settings, { detail: 0 });
    await waitFor(() => expect(activeElement()).toBe(button("Switch to light mode")));
    expect(toolbarRoot().querySelector('input[aria-label="Vue Components"]')).not.toBeNull();
    expect(toolbarRoot().querySelector('input[aria-label="Hide Until Restart"]')).not.toBeNull();
    const input = toolbarRoot().querySelector('textarea[aria-label="Webhook URL"]')!;
    expect(input.closest("[inert]")).not.toBeNull();
    const nav = toolbarRoot().querySelector<HTMLButtonElement>('[class*="settingsNavLink"]')!;
    await fireEvent.click(nav, { detail: 0 });
    const back = button("Back to settings");
    expect(activeElement()).toBe(back);
    expect(button("Switch to light mode").closest("[inert]")).not.toBeNull();
    expect(input.closest("[inert]")).toBeNull();
    await fireEvent.click(back, { detail: 0 });
    expect(activeElement()).toBe(nav);
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    expect(activeElement()).toBe(settings);
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(activeElement()).toBe(button("Start feedback mode"));
  });

  it("keeps consumer positioning classes reachable outside the shadow root", async () => {
    const view = await render(<PageFeedbackToolbarCSS class="consumer-position" />);
    const host = document.querySelector(".consumer-position");
    expect(host?.shadowRoot).toBe(toolbarRoot());
    await view.rerender(<PageFeedbackToolbarCSS class="consumer-position-next" />);
    expect(document.querySelector(".consumer-position")).toBeNull();
    expect(document.querySelector(".consumer-position-next")).toBe(host);
  });
});
