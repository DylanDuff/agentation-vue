import { afterEach, describe, expect, it, vi } from "vitest";
import { getElementPath } from "./element-identification";
import { syncAnnotation } from "./sync";

afterEach(() => vi.unstubAllGlobals());

describe("document-level feedback", () => {
  it.each(["body", "html"])("gives %s feedback a nonempty element path", tag => {
    expect(getElementPath(document.querySelector(tag)! as HTMLElement)).toBe(tag);
  });

  it("continues omitting generic wrappers from descendant paths", () => {
    const button = document.body.appendChild(document.createElement("button"));
    try { expect(getElementPath(button)).toBe("button"); } finally { button.remove(); }
  });

  it.each(["body", "html"])("repairs the missing path when retrying older %s feedback", async element => {
    const fetch = vi.fn(async (_url, request) => {
      const annotation = JSON.parse(request.body);
      return { ok: !!annotation.elementPath, status: 400, json: async () => annotation };
    });
    vi.stubGlobal("fetch", fetch);
    const saved = await syncAnnotation("http://local.test", "session", {
      id: "old-note", x: 20, y: 30, comment: "Adjust the page spacing", element,
      elementPath: "", timestamp: Date.now(),
    });
    expect(saved.elementPath).toBe(element);
  });
});
