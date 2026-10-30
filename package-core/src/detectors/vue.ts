import { sampleElements, type ComponentDetector } from "../detection";
import { findNearestComponentSource, formatSourceLocation, getSourceLocation, getVueComponentName, isVuePage } from "./vue/vue-detection";

/** Reads component names and source files from Vue's dev-mode instance tree */
export const vueDetector: ComponentDetector = {
  name: "Vue",
  isActive: isVuePage,
  getComponentPath(element, mode) {
    return getVueComponentName(element, { mode }).path;
  },
  getSourceFile(element) {
    const result = getSourceLocation(element);
    const loc = result.found ? result : findNearestComponentSource(element);
    return loc.found && loc.source ? formatSourceLocation(loc.source, "path") : undefined;
  },
  isDevBuild() {
    // Vue only links elements to their component in development builds
    return sampleElements().some((element) => "__vueParentComponent" in element);
  },
};
