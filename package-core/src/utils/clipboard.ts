/**
 * Copy text to the system clipboard.
 *
 * Tries the async Clipboard API first, then falls back to a temporary
 * textarea + `document.execCommand("copy")` for contexts where
 * `navigator.clipboard.writeText` is denied (unfocused documents,
 * embedded browsers, missing permissions, non-HTTPS).
 *
 * @returns `true` if text was written to the clipboard, otherwise `false`.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  return copyTextViaExecCommand(text);
}

function copyTextViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  let activeElement = document.activeElement;
  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  const input = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
    ? activeElement
    : null;
  const inputSelection = input && input.selectionStart !== null
    ? { start: input.selectionStart, end: input.selectionEnd!, direction: input.selectionDirection! }
    : null;
  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
    : [];

  try {
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText =
      "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(textarea);

    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    // Cleanup and focus restoration must also run when copying is denied.
    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      activeElement.focus({ preventScroll: true });
      if (input && inputSelection) {
        input.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction);
      }
    }
    if (selection) {
      selection.removeAllRanges();
      for (const range of previousRanges) selection.addRange(range);
    }
  }
}
