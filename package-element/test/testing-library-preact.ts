// Stands in for @testing-library/react when the core toolbar tests run with
// Preact. Same API as the parts those tests use, with two adjustments so the
// tests see what a browser would:
// - Queries come from the current @testing-library/dom (shadow root aware).
// - async act() keeps flushing until updates scheduled by settled promises
//   (animation `finished`, fetch responses) have rendered, like React's act.
//   Preact's own act flushes only what was queued when its callback returned.
import { configure, fireEvent as domFireEvent, getQueriesForElement } from "@testing-library/dom";
import { h, render as preactRender, type ComponentChild } from "preact";
import { useEffect } from "preact/hooks";
import { act as preactAct } from "preact/test-utils";

export * from "@testing-library/dom";

async function drain() {
  for (let round = 0; round < 5; round++) {
    await preactAct(async () => {
      for (let tick = 0; tick < 10; tick++) await Promise.resolve();
    });
  }
}

export function act(callback: () => unknown): any {
  let result: unknown;
  const done = preactAct(() => {
    result = callback();
    return result as void;
  });
  if (result && typeof (result as Promise<unknown>).then === "function") {
    return Promise.resolve(done).then(drain);
  }
  return Promise.resolve(done).then(() => undefined);
}

configure({
  asyncWrapper: async (cb) => {
    const result = await cb();
    await drain();
    return result;
  },
  eventWrapper: (cb) => {
    let result: unknown;
    preactAct(() => {
      result = cb();
    });
    return result as never;
  },
});

const mounted = new Set<HTMLElement>();

export function render(ui: ComponentChild, { container }: { container?: HTMLElement } = {}) {
  const target = container ?? document.body.appendChild(document.createElement("div"));
  mounted.add(target);
  preactAct(() => {
    preactRender(ui, target);
  });
  return {
    container: target,
    baseElement: document.body,
    rerender(next: ComponentChild) {
      preactAct(() => {
        preactRender(next, target);
      });
    },
    unmount() {
      preactAct(() => {
        preactRender(null, target);
      });
    },
    ...getQueriesForElement(document.body),
  };
}

export function cleanup() {
  for (const target of mounted) {
    preactAct(() => {
      preactRender(null, target);
    });
    target.remove();
  }
  mounted.clear();
}

export function renderHook<Result, Props>(hook: (props: Props) => Result, { initialProps }: { initialProps?: Props } = {}) {
  const result = { current: undefined as Result };
  function Probe({ props }: { props: Props }) {
    const value = hook(props);
    useEffect(() => {
      result.current = value;
    });
    result.current = value;
    return null;
  }
  const view = render(h(Probe, { props: initialProps as Props }));
  return {
    result,
    rerender: (props?: Props) => view.rerender(h(Probe, { props: props as Props })),
    unmount: view.unmount,
  };
}

// preact/compat listens for `input` where React's onChange is used on text
// fields (a browser fires input as you type), so a test's change is fired as
// input there. Checkboxes, radios and selects keep change.
function isTextField(element: unknown): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !/^(checkbox|radio|file)$/i.test(element.type);
}

export const fireEvent = new Proxy(domFireEvent, {
  get(target, key, receiver) {
    if (key === "change") {
      return (element: Element, init?: object) =>
        isTextField(element) ? target.input(element, init) : target.change(element, init);
    }
    return Reflect.get(target, key, receiver);
  },
}) as typeof domFireEvent;
