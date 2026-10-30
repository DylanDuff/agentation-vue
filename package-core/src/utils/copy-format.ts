import type { Annotation } from "../types";

export type CopyFormat =
  | "markdown"
  | "source"
  | "classes"
  | { attribute: string };

/** Formatting is local to Copy; Send to Agent retains its structured feedback. */
export function formatCopyOutput(
  annotations: readonly Annotation[],
  markdown: string,
  format: CopyFormat = "markdown",
): string {
  if (format === "markdown") return markdown;
  return [
    ...new Set(
      annotations
        .map((annotation) => {
          if (format === "source") return annotation.sourceFile;
          if (format === "classes") return annotation.cssClasses;
          return annotation.attributes?.[format.attribute];
        })
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ].join("\n");
}
