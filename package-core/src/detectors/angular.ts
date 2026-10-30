import type { ComponentDetector } from "../detection";
import {
  findNearestComponentSource,
  formatSourceLocation,
  getAngularComponentName,
  isAngularDevBuild,
  isAngularPage,
} from "./angular/angular-detection";

/** Reads component names and sources through Angular's development helpers (`window.ng`) */
export const angularDetector: ComponentDetector = {
  name: "Angular",
  isActive: isAngularPage,
  getComponentPath(element, mode) {
    return getAngularComponentName(element, { mode }).path;
  },
  getSourceFile(element) {
    const loc = findNearestComponentSource(element);
    return loc.found && loc.source ? formatSourceLocation(loc.source, "path") : undefined;
  },
  isDevBuild: isAngularDevBuild,
};
