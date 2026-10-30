import { afterEach, describe, expect, it } from "vitest";
import {
  componentNameFromFile,
  findNearestComponentSource,
  getSourceLocation,
  getSvelteComponentName,
  isSveltePage,
} from "./svelte-detection";
import { svelteDetector } from "../svelte";
import { identifyElementWithComponents } from "../../detection";

// Metadata shapes copied from real dev builds: Svelte 5.57 for
//   App.svelte:  <main><Wrapper><Card title="hi" /></Wrapper>{#if true}<p id="cond" />{/if}</main>
//   Wrapper.svelte: {@render children()}
//   Card.svelte: <div class="card"><button id="btn" /></div>
// and Svelte 4 (add_location, 0-based lines, with `char`).
const APP = "/home/me/app/src/App.svelte";
const CARD = "/home/me/app/src/lib/Card.svelte";
const WRAPPER = "/home/me/app/src/lib/Wrapper.svelte";

const cardParent = {
  type: "component",
  file: APP,
  line: 7,
  column: 4,
  componentTag: "Card",
  parent: {
    type: "render",
    file: WRAPPER,
    line: 2,
    column: 0,
    parent: { type: "component", file: APP, line: 6, column: 2, componentTag: "Wrapper" },
  },
};

function svelte5Tree() {
  document.body.innerHTML = `<main class="app"><div class="card"><button id="btn">hi</button></div><p id="cond">x</p></main>`;
  const main = document.querySelector("main")!;
  const card = document.querySelector(".card")!;
  const button = document.querySelector("#btn")!;
  const cond = document.querySelector("#cond")!;
  Object.assign(main, { __svelte_meta: { loc: { file: APP, line: 5, column: 0 } } });
  Object.assign(card, { __svelte_meta: { loc: { file: CARD, line: 2, column: 0 }, parent: cardParent } });
  Object.assign(button, { __svelte_meta: { loc: { file: CARD, line: 3, column: 2 }, parent: cardParent } });
  Object.assign(cond, {
    __svelte_meta: { loc: { file: APP, line: 9, column: 12 }, parent: { type: "if", file: APP, line: 9, column: 2 } },
  });
  return { main, card, button: button as HTMLElement, cond: cond as HTMLElement };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { __svelte?: unknown }).__svelte;
});

describe("svelte component names", () => {
  it("walks Svelte 5's render stack, including components without their own elements", () => {
    const { button } = svelte5Tree();
    expect(getSvelteComponentName(button, { mode: "all" }).path).toBe("<App> <Wrapper> <Card>");
  });

  it("names components by their own file, not by the tag they were imported as", () => {
    const { button } = svelte5Tree();
    const aliased = { ...cardParent, componentTag: "Thing" };
    Object.assign(button, { __svelte_meta: { loc: { file: CARD, line: 3, column: 2 }, parent: aliased } });
    expect(getSvelteComponentName(button, { mode: "all" }).components).toEqual(["Card", "Wrapper", "App"]);
  });

  it("skips blocks and keeps the root component", () => {
    const { cond, main } = svelte5Tree();
    expect(getSvelteComponentName(cond, { mode: "all" }).path).toBe("<App>");
    expect(getSvelteComponentName(main as HTMLElement, { mode: "all" }).path).toBe("<App>");
  });

  it("filters wrappers in filtered mode", () => {
    const { button } = svelte5Tree();
    expect(getSvelteComponentName(button, { mode: "filtered" }).path).toBe("<App> <Card>");
  });

  it("falls back to ancestor files on Svelte 4", () => {
    document.body.innerHTML = `<main><div class="card"><button id="btn">x</button></div></main>`;
    Object.assign(document.querySelector("main")!, { __svelte_meta: { loc: { file: APP, line: 0, column: 0, char: 0 } } });
    Object.assign(document.querySelector(".card")!, { __svelte_meta: { loc: { file: CARD, line: 1, column: 2, char: 21 } } });
    const button = document.querySelector("#btn") as HTMLElement;
    Object.assign(button, { __svelte_meta: { loc: { file: CARD, line: 2, column: 4, char: 44 } } });
    expect(getSvelteComponentName(button, { mode: "all" }).path).toBe("<App> <Card>");
  });

  it("returns nothing outside Svelte", () => {
    document.body.innerHTML = `<div id="plain"></div>`;
    expect(getSvelteComponentName(document.querySelector("#plain") as HTMLElement).path).toBeNull();
  });

  it("names SvelteKit route files after their folder", () => {
    expect(componentNameFromFile("/app/src/routes/blog/[slug]/+page.svelte")).toBe("BlogSlugPage");
    expect(componentNameFromFile("/app/src/routes/(marketing)/about/+layout.svelte")).toBe("AboutLayout");
    expect(componentNameFromFile("/app/src/routes/+page.svelte")).toBe("Page");
    expect(componentNameFromFile("src/lib/date-picker.svelte")).toBe("DatePicker");
  });
});

describe("svelte source locations", () => {
  it("reports the exact element line with a 1-based column", () => {
    const { button } = svelte5Tree();
    const result = getSourceLocation(button);
    expect(result.found).toBe(true);
    expect(result.source).toMatchObject({ fileName: "src/lib/Card.svelte", lineNumber: 3, columnNumber: 3, componentName: "Card" });
  });

  it("converts Svelte 4's 0-based lines", () => {
    document.body.innerHTML = `<button id="btn">x</button>`;
    const button = document.querySelector("#btn") as HTMLElement;
    Object.assign(button, { __svelte_meta: { loc: { file: CARD, line: 2, column: 4, char: 44 } } });
    expect(getSourceLocation(button).source).toMatchObject({ lineNumber: 3, columnNumber: 5 });
  });

  it("looks up the DOM for elements Svelte did not render", () => {
    const { card } = svelte5Tree();
    const injected = document.createElement("span");
    card.appendChild(injected);
    expect(getSourceLocation(injected).found).toBe(false);
    expect(findNearestComponentSource(injected).source?.fileName).toBe("src/lib/Card.svelte");
  });
});

describe("svelte detector", () => {
  it("is active once Svelte discloses its version", () => {
    expect(isSveltePage()).toBe(false);
    (window as unknown as { __svelte: { v: Set<string> } }).__svelte = { v: new Set(["5"]) };
    expect(svelteDetector.isActive()).toBe(true);
  });

  it("plugs into element identification", () => {
    const { button } = svelte5Tree();
    const result = identifyElementWithComponents(button, svelteDetector, "filtered");
    expect(result.reactComponents).toBe("<App> <Card>");
    expect(result.name.startsWith("<App> <Card> ")).toBe(true);
    expect(svelteDetector.getSourceFile?.(button)).toBe("src/lib/Card.svelte:3:3");
  });
});
