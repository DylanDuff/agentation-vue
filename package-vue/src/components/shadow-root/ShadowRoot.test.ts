import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import ShadowRoot from "./ShadowRoot.vue";

describe("ShadowRoot", () => {
  it("renders slot content inside an attached shadow root", async () => {
    const wrapper = mount(ShadowRoot, {
      slots: { default: () => h("p", { class: "inside" }, "hello") },
      attachTo: document.body,
    });
    await nextTick();
    const shadow = (wrapper.element as HTMLElement).shadowRoot;
    expect(shadow).not.toBeNull();
    expect(shadow!.querySelector(".inside")?.textContent).toBe("hello");
    wrapper.unmount();
  });
});
