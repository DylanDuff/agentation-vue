import type { ComponentDetector } from "@agentation/core/detection";
import { angularDetector } from "@agentation/core/detectors/angular";
import { reactNamesDetector } from "@agentation/core/detectors/react";
import { svelteDetector } from "@agentation/core/detectors/svelte";
import { vueDetector } from "@agentation/core/detectors/vue";
import { mountToolbar, type AgentationInstance, type AgentationOptions } from "./mount";

/** Detectors used when none are chosen: every framework the core knows */
export const DEFAULT_DETECTORS: readonly ComponentDetector[] = [vueDetector, svelteDetector, angularDetector, reactNamesDetector];

/** Renders the toolbar into `container`, detecting every framework the core knows unless `detectors` is set */
export function mountAgentation(container: Element | DocumentFragment, options: AgentationOptions = {}): AgentationInstance {
  const withDefaults = (next: AgentationOptions) => ({ ...next, detectors: next.detectors ?? DEFAULT_DETECTORS });
  const instance = mountToolbar(container, withDefaults(options));
  return { update: (next) => instance.update(withDefaults(next)), destroy: instance.destroy };
}
