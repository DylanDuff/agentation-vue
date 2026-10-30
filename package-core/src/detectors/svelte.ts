import { sampleElements, type ComponentDetector } from "../detection";
import { findNearestComponentSource, formatSourceLocation, getSvelteComponentName, isSveltePage } from "./svelte/svelte-detection";

/** Reads component names and source lines from Svelte's dev-mode element metadata */
export const svelteDetector: ComponentDetector = {
  name: "Svelte",
  isActive: isSveltePage,
  getComponentPath(element, mode) {
    return getSvelteComponentName(element, { mode }).path;
  },
  getSourceFile(element) {
    const loc = findNearestComponentSource(element);
    return loc.found && loc.source ? formatSourceLocation(loc.source, "path") : undefined;
  },
  isDevBuild() {
    // Svelte only records element locations in development builds
    return sampleElements().some((element) => "__svelte_meta" in element);
  },
};
