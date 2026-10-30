import * as sass from "sass";
import postcss from "postcss";
import postcssModules from "postcss-modules";
import type { Plugin } from "vite";

// Mirrors the React package's tsup plugin: SCSS is compiled to a CSS string that
// ships inside the JS bundle, so it can be injected into the toolbar's shadow root.
// `*.module.scss` also exports its scoped class map as the default export.
export function scssModulesPlugin(): Plugin {
  return {
    name: "agentation-scss-modules",
    enforce: "pre",
    async load(id) {
      if (!id.endsWith(".scss")) return null;
      const { css: sassOutput } = sass.compile(id);

      if (!id.includes(".module.")) {
        return `export const css = ${JSON.stringify(sassOutput)};`;
      }

      let classNames: Record<string, string> = {};
      const { css } = await postcss([
        postcssModules({
          getJSON(_, json) {
            classNames = json;
          },
          generateScopedName: "[name]__[local]___[hash:base64:5]",
        }),
      ]).process(sassOutput, { from: id });

      return `export const css = ${JSON.stringify(css)};\nexport default ${JSON.stringify(classNames)};`;
    },
  };
}
