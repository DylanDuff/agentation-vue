import { options } from "preact";
// Same jsdom gaps the core suite fills for Preact (animation event handlers)
import "../../package-element/test/setup";

// Preact runs effects after the next animation frame; run them on a microtask
options.requestAnimationFrame = (callback) => queueMicrotask(callback);
