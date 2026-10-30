import { describe, expect, it } from "vitest";
import { captureElementAttributes, identifyingAttributeSelector } from "./element-attributes";
import { getElementPath } from "./element-identification";

describe("identifying attributes", () => {
  it("uses stable identifiers without collecting arbitrary page data", () => {
    const element = document.createElement("button");
    element.setAttribute("data-state", "open");
    element.setAttribute("data-private-payload", "unrelated");
    element.setAttribute("data-testid", "checkout");
    expect(getElementPath(element)).toBe('button[data-testid="checkout"]');
    expect(captureElementAttributes(element)).toEqual({ "data-testid": "checkout" });
  });

  it("escapes values into a selector that still matches the original element", () => {
    const element = document.createElement("button");
    element.setAttribute("data-qa", 'a"b\\c\nnext');
    expect(element.matches(identifyingAttributeSelector(element))).toBe(true);
  });

  it("uses explicit attributes, omits oversized identifiers, and limits path noise", () => {
    const element = document.createElement("div");
    for (const name of ["data-a", "data-b", "data-c"]) element.setAttribute(name, name);
    element.setAttribute("data-long", "x".repeat(501));
    expect(captureElementAttributes(element, ["data-a", "data-long"])).toEqual({ "data-a": "data-a" });
    expect(getElementPath(element, 4, ["data-c", "data-b", "data-a"]))
      .toBe('div[data-c="data-c"][data-b="data-b"]');
  });
});
