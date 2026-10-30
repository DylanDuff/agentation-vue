// Browsers expose on<event> handler properties for animation and transition
// events; jsdom does not. Preact picks an event's listener name by checking
// for that property, so without it `onAnimationEnd` would listen for
// "AnimationEnd" instead of "animationend". Match the browser.
for (const name of ["onanimationstart", "onanimationend", "onanimationiteration", "onanimationcancel", "ontransitionstart", "ontransitionend", "ontransitionrun", "ontransitioncancel"]) {
  if (!(name in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, name, { value: null, writable: true, configurable: true });
  }
}

// @testing-library/react cleans up after each test on its own; so does its stand-in
import { afterEach } from "vitest";
import { cleanup } from "./testing-library-preact";

afterEach(() => cleanup());

// React writes a textarea's initial value as its text too, so tests read the
// comment with textContent and getByText. Preact sets only `value`, which is
// what a browser shows. Mirror the value into the text, as React's output does.
const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!;
Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
  configurable: true,
  get() {
    return valueDescriptor.get!.call(this);
  },
  set(next: string) {
    valueDescriptor.set!.call(this, next);
    if (!this.isConnected || this.textContent !== next) this.defaultValue = next;
  },
});
