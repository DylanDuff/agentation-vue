import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "./clipboard";

function stubExecCommand(impl: Document["execCommand"]) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: impl,
  });
  return vi.spyOn(document, "execCommand");
}

describe("copyTextToClipboard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("returns true when Clipboard API write succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when Clipboard API throws", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new Error("Document is not focused."));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });
    const exec = stubExecCommand(vi.fn().mockReturnValue(true));

    await expect(copyTextToClipboard("fallback text")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("fallback text");
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when Clipboard API is missing", async () => {
    vi.stubGlobal("navigator", {});
    const exec = stubExecCommand(vi.fn().mockReturnValue(true));

    await expect(copyTextToClipboard("no api")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("returns false when both Clipboard API and execCommand fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });
    stubExecCommand(vi.fn().mockReturnValue(false));

    await expect(copyTextToClipboard("nope")).resolves.toBe(false);
  });

  it("returns false when execCommand throws", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    stubExecCommand(
      vi.fn(() => {
        throw new Error("exec failed");
      }),
    );

    await expect(copyTextToClipboard("boom")).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it.each([true, false, "throws"])("restores a shadow input's focus and selection after fallback (%s)", async (result) => {
    vi.stubGlobal("navigator", {});
    const host = document.createElement("div");
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    input.value = "preserve this selection";
    root.append(input);
    input.focus();
    input.setSelectionRange(2, 9, "backward");
    stubExecCommand(vi.fn(() => {
      // Simulate the selection lost when a different text field receives focus.
      input.setSelectionRange(0, 0);
      if (result === "throws") throw new Error("denied");
      return result === true;
    }));

    expect(await copyTextToClipboard("feedback")).toBe(result === true);
    expect(root.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 9, "backward"]);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("restores the selected page text after a failed fallback", async () => {
    vi.stubGlobal("navigator", {});
    const text = document.createElement("p");
    text.textContent = "keep this selection";
    document.body.append(text);
    const range = document.createRange();
    range.selectNodeContents(text);
    document.getSelection()!.addRange(range);
    stubExecCommand(vi.fn(() => {
      document.getSelection()!.removeAllRanges();
      throw new Error("denied");
    }));
    expect(await copyTextToClipboard("feedback")).toBe(false);
    expect(document.getSelection()!.toString()).toBe("keep this selection");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
