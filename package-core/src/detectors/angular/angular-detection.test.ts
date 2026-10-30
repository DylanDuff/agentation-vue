import { afterEach, describe, expect, it } from "vitest";
import {
  findNearestComponentSource,
  getAngularComponentName,
  getSourceLocation,
  isAngularDevBuild,
  isAngularPage,
  parseSourceLocationAttribute,
} from "./angular-detection";
import { angularDetector } from "../angular";
import { identifyElementWithComponents } from "../../detection";

// Shapes copied from a real Angular 21 development build of
//   app.component.ts (inline template): <main><app-product-card /></main>
//   product-card.component.html:        <div class="card"><h2>{{ title }}</h2></div>
// compiled with template source locations on.
class AppComponent {
  static ɵcmp = { debugInfo: { className: "AppComponent", filePath: "src/app/app.component.ts", lineNumber: 18 } };
}
class ProductCardComponent {
  static ɵcmp = {
    debugInfo: { className: "ProductCardComponent", filePath: "src/app/product-card.component.ts", lineNumber: 7 },
  };
}

function angularTree({ sourceLocations = true } = {}) {
  document.body.innerHTML = `
    <app-root ng-version="21.2.25">
      <main class="page">
        <app-product-card><div class="card"><h2 id="title">Starter</h2></div></app-product-card>
      </main>
    </app-root>`;
  const root = document.querySelector("app-root")!;
  const card = document.querySelector("app-product-card")!;
  const title = document.getElementById("title") as HTMLElement;
  const main = document.querySelector("main")!;
  if (sourceLocations) {
    main.setAttribute("data-ng-source-location", "src/app/app.component.ts@o:242,l:7,c:4");
    card.querySelector(".card")!.setAttribute("data-ng-source-location", "src/app/product-card.component.html@o:0,l:0,c:0");
    title.setAttribute("data-ng-source-location", "src/app/product-card.component.html@o:21,l:1,c:2");
  }
  const app = new AppComponent();
  const product = new ProductCardComponent();
  const hosts = new Map<Element, object>([[root, app], [card, product]]);
  (window as unknown as { ng: object }).ng = {
    getComponent: (element: Element) => hosts.get(element) ?? null,
    getOwningComponent: (element: Element) => (card.contains(element) && element !== card ? product : app),
  };
  return { title, main };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { ng?: unknown }).ng;
});

describe("angular component names", () => {
  it("walks the component hosts above an element", () => {
    const { title } = angularTree();
    expect(getAngularComponentName(title, { mode: "all" }).path).toBe("<AppComponent> <ProductCardComponent>");
  });

  it("falls back to the class name without CLI debug info", () => {
    const { title } = angularTree();
    const plain = class CheckoutComponent {};
    (window as unknown as { ng: { getComponent: (e: Element) => object | null } }).ng.getComponent = (element) =>
      element.tagName === "APP-PRODUCT-CARD" ? new plain() : null;
    expect(getAngularComponentName(title).path).toBe("<CheckoutComponent>");
  });

  it("skips minified class names from production builds", () => {
    const { title } = angularTree();
    const minified = class e {};
    (window as unknown as { ng: { getComponent: (e: Element) => object | null } }).ng.getComponent = () => new minified();
    expect(getAngularComponentName(title).path).toBeNull();
  });

  it("returns nothing without Angular's development helpers", () => {
    const { title } = angularTree();
    delete (window as unknown as { ng?: unknown }).ng;
    expect(getAngularComponentName(title).path).toBeNull();
    expect(isAngularDevBuild()).toBe(false);
    expect(isAngularPage()).toBe(true);
  });
});

describe("angular source locations", () => {
  it("parses template locations, converting 0-based lines and columns", () => {
    expect(parseSourceLocationAttribute("src/app/card.component.html@o:21,l:1,c:2")).toEqual({
      fileName: "src/app/card.component.html",
      lineNumber: 2,
      columnNumber: 3,
    });
    expect(parseSourceLocationAttribute("nonsense")).toBeNull();
  });

  it("reports the exact template line and the owning component", () => {
    const { title } = angularTree();
    expect(getSourceLocation(title).source).toMatchObject({
      fileName: "src/app/product-card.component.html",
      lineNumber: 2,
      columnNumber: 3,
      componentName: "ProductCardComponent",
    });
  });

  it("looks up the DOM for elements without a template location", () => {
    const { title } = angularTree();
    const injected = title.appendChild(document.createElement("span"));
    expect(findNearestComponentSource(injected).source?.fileName).toBe("src/app/product-card.component.html");
  });

  it("falls back to the component's class file when template locations are off", () => {
    const { title } = angularTree({ sourceLocations: false });
    expect(findNearestComponentSource(title).source).toMatchObject({
      fileName: "src/app/product-card.component.ts",
      lineNumber: 7,
      componentName: "ProductCardComponent",
    });
  });

  it("says why when nothing is found", () => {
    document.body.innerHTML = `<div id="plain"></div>`;
    expect(findNearestComponentSource(document.getElementById("plain")!)).toMatchObject({
      found: false,
      reason: "not-angular-app",
    });
  });
});

describe("angular detector", () => {
  it("plugs into element identification", () => {
    const { title } = angularTree();
    expect(angularDetector.isActive()).toBe(true);
    expect(angularDetector.isDevBuild?.()).toBe(true);
    const result = identifyElementWithComponents(title, angularDetector, "filtered");
    expect(result.reactComponents).toBe("<AppComponent> <ProductCardComponent>");
    expect(angularDetector.getSourceFile?.(title)).toBe("src/app/product-card.component.html:2:3");
  });
});
