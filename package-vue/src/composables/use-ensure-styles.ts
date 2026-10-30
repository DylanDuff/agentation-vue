import { ensureStyles } from "../utils/ensure-styles";

/** Template ref callback that installs a component stylesheet where the element renders. */
export function useEnsureStyles(id: string, css: string | undefined) {
  return (element: unknown) => {
    if (element instanceof Element) ensureStyles(element.getRootNode(), id, css);
  };
}
