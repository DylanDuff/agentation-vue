import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { RearrangeOverlay } from "./rearrange";
import { ShadowRoot } from "../shadow-root";
import type { RearrangeState } from "@agentation/core/design-mode/types";

afterEach(() => vi.restoreAllMocks());

describe("rearrange in Shadow DOM", () => {
  it("moves the first captured outline during the drag, before release", () => {
    function Harness() {
      const [state, setState] = useState<RearrangeState>({sections: [], originalOrder: [], detectedAt: 0});
      return <><section data-testid="page-target">Page section</section><ShadowRoot host="agentation-test"><RearrangeOverlay rearrangeState={state} onChange={setState} isDarkMode /></ShadowRoot></>;
    }
    const view = render(<Harness />);
    const target = view.getByTestId("page-target");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({x:100,y:100,width:200,height:100,top:100,left:100,right:300,bottom:200,toJSON:()=>({})});
    fireEvent.mouseDown(target, {button:0,clientX:110,clientY:110});
    const root = document.querySelector("agentation-test")!.shadowRoot!;
    const outline = root.querySelector<HTMLElement>("[data-rearrange-section]")!;
    expect(outline).not.toBeNull();
    try {
      fireEvent.mouseMove(window, {clientX:160,clientY:150});
      expect(outline.style.transform).toBe("translate(50px, 40px)");
    } finally {
      fireEvent.mouseUp(window);
    }
  });
});
