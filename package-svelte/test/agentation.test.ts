import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/dom";
import { flushSync, mount, unmount } from "svelte";
import App from "./fixtures/App.svelte";

function shadow() {
  return document.querySelector("agentation-toolbar")!.shadowRoot!;
}
function toolbar() {
  return within(shadow() as unknown as HTMLElement);
}
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  flushSync();
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

let app: Record<string, unknown> | undefined;

function render(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement("div"));
  app = mount(App, { target, props: { onAnnotationAdd: () => {}, onSubmit: () => {}, ...props } });
  return target;
}

async function annotate(element: Element, comment: string) {
  fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
  await settle();
  const original = document.elementFromPoint;
  document.elementFromPoint = () => element;
  try {
    fireEvent.click(element, { clientX: 20, clientY: 20 });
  } finally {
    document.elementFromPoint = original;
  }
  await settle();
  fireEvent.input(toolbar().getByRole("textbox"), { target: { value: comment } });
  await settle();
  fireEvent.click(toolbar().getByRole("button", { name: "Add" }));
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  (window as unknown as { __svelte?: { v: Set<string> } }).__svelte ??= { v: new Set(["5"]) };
});

afterEach(() => {
  if (app) unmount(app);
  app = undefined;
  document.body.innerHTML = "";
});

describe("<Agentation> (Svelte)", () => {
  it("renders the shared toolbar", async () => {
    render();
    await settle();
    expect(toolbar().getByRole("button", { name: "Start feedback mode" })).toBeTruthy();
  });

  it("annotates with the Svelte component path and source line", async () => {
    const onAnnotationAdd = vi.fn();
    render({ onAnnotationAdd });
    await settle();
    await annotate(document.getElementById("card-title")!, "Bigger price");
    expect(onAnnotationAdd).toHaveBeenCalledOnce();
    const annotation = onAnnotationAdd.mock.calls[0][0];
    expect(annotation).toMatchObject({ comment: "Bigger price" });
    expect(annotation.reactComponents).toBe("<App> <Card>");
    expect(annotation.sourceFile).toMatch(/fixtures\/Card\.svelte:6:3$/);
  });

  it("labels component detection as Svelte", async () => {
    render();
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Settings" }));
    await settle();
    expect(shadow().querySelector('input[aria-label="Svelte Components"]')).not.toBeNull();
  });

  it("follows prop changes, such as adding a submit handler", async () => {
    render();
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    expect(toolbar().queryByRole("button", { name: /send/i })).toBeNull();
    // Leave feedback mode so the page's own button gets the click
    fireEvent.click(toolbar().getByRole("button", { name: "Exit" }));
    await settle();
    fireEvent.click(document.getElementById("enable-send")!);
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    expect(toolbar().queryByRole("button", { name: /send/i })).not.toBeNull();
  });

  it("removes the toolbar when the component is destroyed", async () => {
    render();
    await settle();
    unmount(app!);
    app = undefined;
    await settle();
    expect(document.querySelector("agentation-toolbar")).toBeNull();
  });
});
