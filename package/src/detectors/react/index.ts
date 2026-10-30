import type { ComponentDetector } from "@agentation/core/detection";
import { getReactComponentName, isReactPage } from "./react-detection";
import { findNearestComponentSource, formatSourceLocation, getSourceLocation } from "./source-location";

/** Reads component names and source files from React's dev-mode fiber tree */
export const reactDetector: ComponentDetector = {
  name: "React",
  isActive: isReactPage,
  getComponentPath(element, mode) {
    return getReactComponentName(element, { mode }).path;
  },
  getSourceFile(element) {
    const result = getSourceLocation(element);
    const loc = result.found ? result : findNearestComponentSource(element);
    return loc.found && loc.source ? formatSourceLocation(loc.source, "path") : undefined;
  },
};
