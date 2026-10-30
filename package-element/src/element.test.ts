import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor, within } from "@testing-library/dom";
import { defineAgentationElement, mountAgentation, type AgentationElement } from "./index";
import "../test/setup";

function toolbar() {
  return within(document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement);
}

async function settle() {
  // Preact runs effects after the next animation frame
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(() => {
  localStorage.clear();
  defineAgentationElement();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("<agentation-feedback>", () => {
  it("renders the toolbar into the page from plain HTML", async () => {
    document.body.innerHTML = `<agentation-feedback app-name="Docs"></agentation-feedback>`;
    await settle();
    expect(toolbar().getByRole("button", { name: "Start feedback mode" })).toBeTruthy();
  });

  it("removes the toolbar when the element leaves the page", async () => {
    document.body.innerHTML = `<agentation-feedback></agentation-feedback>`;
    await settle();
    document.querySelector("agentation-feedback")!.remove();
    await settle();
    expect(document.querySelector("agentation-toolbar")).toBeNull();
  });

  it("calls option callbacks and dispatches matching DOM events", async () => {
    document.body.innerHTML = `<p id="target">Pricing</p><agentation-feedback></agentation-feedback>`;
    const element = document.querySelector("agentation-feedback") as AgentationElement;
    const onAnnotationAdd = vi.fn();
    const heard = vi.fn();
    element.options = { onAnnotationAdd };
    document.addEventListener("agentation:annotation-add", (event) => heard((event as CustomEvent).detail));
    await settle();

    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    const target = document.getElementById("target")!;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try {
      fireEvent.click(target, { clientX: 20, clientY: 20 });
    } finally {
      document.elementFromPoint = original;
    }
    await settle();
    fireEvent.input(toolbar().getByRole("textbox"), { target: { value: "Clarify pricing" } });
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Add" }));
    await settle();

    expect(onAnnotationAdd).toHaveBeenCalledOnce();
    expect(onAnnotationAdd.mock.calls[0][0]).toMatchObject({ comment: "Clarify pricing" });
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ comment: "Clarify pricing" }));
  });

  it("shows Send to Agent only when a submit handler or the send attribute is present", async () => {
    document.body.innerHTML = `<agentation-feedback></agentation-feedback>`;
    const element = document.querySelector("agentation-feedback") as AgentationElement;
    await settle();
    const send = () => toolbar().queryByRole("button", { name: /send/i });
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    const before = send();
    element.setAttribute("send", "");
    await settle();
    expect(before).toBeNull();
    await waitFor(() => expect(send()).not.toBeNull());
  });
});

describe("mountAgentation", () => {
  it("labels component detection after the detector that finds the page's framework", async () => {
    (window as unknown as { __svelte: { v: Set<string> } }).__svelte = { v: new Set(["5"]) };
    const container = document.body.appendChild(document.createElement("div"));
    const instance = mountAgentation(container, { isDevMode: true });
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Settings" }));
    await settle();
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    expect(shadow.querySelector('input[aria-label="Svelte Components"]')).not.toBeNull();
    instance.destroy();
    delete (window as unknown as { __svelte?: unknown }).__svelte;
  });

  it("notices a development build that starts after the toolbar", async () => {
    const container = document.body.appendChild(document.createElement("div"));
    const instance = mountAgentation(container);
    await settle();
    // The app boots later and records Svelte's dev metadata
    (window as unknown as { __svelte: { v: Set<string> } }).__svelte = { v: new Set(["5"]) };
    const app = document.body.appendChild(document.createElement("main"));
    Object.assign(app, { __svelte_meta: { loc: { file: "/app/src/App.svelte", line: 1, column: 0 } } });
    fireEvent.click(toolbar().getByRole("button", { name: "Start feedback mode" }));
    await settle();
    fireEvent.click(toolbar().getByRole("button", { name: "Settings" }));
    await settle();
    const shadow = document.querySelector("agentation-toolbar")!.shadowRoot!;
    const toggle = shadow.querySelector('input[aria-label="Svelte Components"]') as HTMLInputElement;
    expect(toggle.disabled).toBe(false);
    instance.destroy();
    delete (window as unknown as { __svelte?: unknown }).__svelte;
  });
});
