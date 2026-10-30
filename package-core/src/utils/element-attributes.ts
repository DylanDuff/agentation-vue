/** Only stable, intentional identifiers are collected by default. */
export const DEFAULT_IDENTIFYING_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-qa",
  "data-cy",
  "data-component",
] as const;

export function captureElementAttributes(
  element: Element,
  names: readonly string[] = DEFAULT_IDENTIFYING_ATTRIBUTES,
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const name of [...new Set(names)].slice(0, 16)) {
    if (!/^[a-zA-Z_][\w:.-]*$/.test(name)) continue;
    const value = element.getAttribute(name);
    // Omit oversized values rather than reporting a truncated identifier.
    if (value != null && value.length <= 500) {
      Object.defineProperty(attributes, name, { value, enumerable: true });
    }
  }
  return attributes;
}

export function identifyingAttributeSelector(
  element: Element,
  names: readonly string[] = DEFAULT_IDENTIFYING_ATTRIBUTES,
): string {
  return Object.entries(captureElementAttributes(element, names))
    .filter(([name, value]) => /^data-[a-z0-9_-]+$/.test(name) && value.length <= 120)
    .slice(0, 2)
    .map(
      ([name, value]) =>
        `[${name}="${value.replace(/[\\"\n\r\f\0]/g, (char) =>
          char === "\\" || char === '"' ? `\\${char}` : `\\${char.charCodeAt(0).toString(16)} `,
        )}"]`,
    )
    .join("");
}
