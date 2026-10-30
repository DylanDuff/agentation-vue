import { sampleElements, type ComponentDetector } from "../detection";
import { getReactComponentName, isReactPage } from "./react/react-detection";

/**
 * React component names from the fiber tree, without source files. Source
 * lookup needs the page's own `react` module, so the React adapter adds it;
 * this detector serves pages that load Agentation outside React.
 */
export const reactNamesDetector: ComponentDetector = {
  name: "React",
  isActive: isReactPage,
  getComponentPath(element, mode) {
    return getReactComponentName(element, { mode }).path;
  },
  isDevBuild() {
    // Development fibers record their owner; production fibers do not
    for (const element of sampleElements()) {
      const key = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
      if (key) return "_debugOwner" in ((element as unknown as Record<string, object>)[key] ?? {});
    }
    return false;
  },
};
