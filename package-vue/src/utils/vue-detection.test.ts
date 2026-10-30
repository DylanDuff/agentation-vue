import { mount } from "@vue/test-utils";
import { defineComponent, h, Transition } from "vue";
import {
  getVueComponentName,
  getSourceLocation,
  formatSourceLocation,
  cleanSourcePath,
} from "@agentation/core/detectors/vue/vue-detection";
import ShadowRoot from "../components/shadow-root/ShadowRoot.vue";

const SubmitButton = defineComponent({
  name: "SubmitButton",
  setup: () => () => h("button", { class: "submit-button" }, h("span", "Send")),
});
const LoginForm = defineComponent({
  name: "LoginForm",
  setup: () => () => h(Transition, null, () => h("form", h(SubmitButton))),
});

describe("getVueComponentName", () => {
  it("collects component names outermost first and skips internals", () => {
    const wrapper = mount(LoginForm);
    const span = wrapper.find("span").element as HTMLElement;
    const info = getVueComponentName(span);
    expect(info.components).toEqual(["SubmitButton", "LoginForm"]);
    expect(info.path).toBe("<LoginForm> <SubmitButton>");
    expect(getVueComponentName(span, { mode: "all" }).components).toContain("Transition");
  });

  it("returns an empty result outside Vue", () => {
    const el = document.createElement("div");
    expect(getVueComponentName(el)).toEqual({ path: null, components: [] });
  });
});

describe("getSourceLocation", () => {
  it("reads __file from SFCs", () => {
    const wrapper = mount(ShadowRoot);
    const result = getSourceLocation(wrapper.element as HTMLElement);
    expect(result.found).toBe(true);
    expect(result.source?.fileName).toBe("src/components/shadow-root/ShadowRoot.vue");
    expect(formatSourceLocation(result.source!)).toBe("src/components/shadow-root/ShadowRoot.vue");
  });

  it("prefers vite-plugin-vue-inspector line data", () => {
    const el = document.createElement("div");
    el.setAttribute("data-v-inspector", "/home/me/app/src/App.vue:12:5");
    const result = getSourceLocation(el);
    expect(formatSourceLocation(result.source!)).toBe("src/App.vue:12:5");
  });

  it("cleans absolute paths", () => {
    expect(cleanSourcePath("C:\\work\\site\\components\\Hero.vue")).toBe("components/Hero.vue");
  });
});
