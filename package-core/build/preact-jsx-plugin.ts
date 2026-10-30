import { transformWithEsbuild, type Plugin } from "vite";

/**
 * Compiles the core UI's TSX for Preact in builds that also use another JSX
 * flavour (Vue's JSX plugin takes over every .tsx file and leaves esbuild
 * none). Only files under package-core are touched.
 */
export function preactJsxPlugin(): Plugin {
  return {
    name: "agentation-preact-jsx",
    enforce: "pre",
    async transform(code, id) {
      if (!/package-core\/src\/.*\.tsx$/.test(id.split("?")[0])) return null;
      return transformWithEsbuild(code, id, { loader: "tsx", jsx: "automatic", jsxImportSource: "preact" });
    },
  };
}
