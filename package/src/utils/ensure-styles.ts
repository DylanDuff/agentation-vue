import { useCallback } from "react";
import { ensureStyles } from "@agentation/core/utils/ensure-styles";

export { ensureStyles };

/** Callback ref that installs a component stylesheet where the element renders. */
export function useEnsureStyles(id: string, css: string | undefined) {
  return useCallback((element: Element | null) => {
    if (element) ensureStyles(element.getRootNode(), id, css);
  }, [id, css]);
}
