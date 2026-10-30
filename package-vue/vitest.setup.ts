import { afterEach } from "vitest";
import { options } from "preact";
import { cleanup } from "./test/test-utils";
// Same jsdom gaps the core suite fills for Preact (animation event handlers)
import "../package-element/test/setup";

// Preact runs effects after the next animation frame. The test helpers settle
// on microtasks (and some tests use fake timers), so run them on a microtask.
options.requestAnimationFrame = (callback) => queueMicrotask(callback);

afterEach(() => cleanup());
