// Test helpers that mirror the parts of @testing-library/react the upstream
// toolbar tests use. Vue patches the DOM on the next tick rather than inside
// act(), so every helper that can change state is async and flushes.
import { defineComponent, nextTick, shallowRef, type VNodeChild } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { fireEvent as domFireEvent, getQueriesForElement } from "@testing-library/dom";

export { screen, waitFor, within } from "@testing-library/dom";

const mounted = new Set<VueWrapper>();

/** Let effects, the renders they cause, and their effects settle. */
export async function flush() {
  for (let i = 0; i < 5; i++) {
    await nextTick();
    await Promise.resolve();
  }
}

export async function render(node: VNodeChild) {
  const current = shallowRef(node);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const wrapper = mount(defineComponent({ render: () => current.value }), {
    attachTo: container,
  });
  mounted.add(wrapper);
  await flush();
  return {
    ...getQueriesForElement(document.body),
    container,
    async rerender(next: VNodeChild) {
      current.value = next;
      await flush();
    },
    async unmount() {
      wrapper.unmount();
      mounted.delete(wrapper);
      container.remove();
      await flush();
    },
  };
}

export async function act(work?: () => unknown) {
  const result = work?.();
  if (result && typeof (result as Promise<unknown>).then === "function") await result;
  await flush();
}

type DomFireEvent = typeof domFireEvent;
type AsyncFireEvent = {
  [K in keyof DomFireEvent]: DomFireEvent[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : never;
};

export const fireEvent = new Proxy(domFireEvent, {
  get(target, key: string) {
    const fire = (target as unknown as Record<string, (...args: unknown[]) => boolean>)[key];
    return async (...args: unknown[]) => {
      const result = fire(...args);
      // One render pass, like React's act() around an event. Promise
      // callbacks queued by the render (such as exit completions) run later.
      await nextTick();
      return result;
    };
  },
  apply(target, _this, args: Parameters<DomFireEvent>) {
    const result = target(...args);
    return nextTick().then(() => result);
  },
}) as unknown as AsyncFireEvent & ((...args: Parameters<DomFireEvent>) => Promise<boolean>);

/** Unmount everything rendered by a test (React Testing Library does this automatically). */
export function cleanup() {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.clear();
  document.body.innerHTML = "";
}
