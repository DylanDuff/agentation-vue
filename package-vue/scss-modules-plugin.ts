import * as sass from "sass";
import postcss from "postcss";
import postcssModules from "postcss-modules";
import type { Plugin } from "vite";

// Mirrors the React package's tsup plugin: SCSS is compiled to a CSS string that
// ships inside the JS bundle, so it can be injected into the toolbar's shadow root.
// `*.module.scss` also exports its scoped class map as the default export.
const SUFFIX = ".agentation-css.js";

export function scssModulesPlugin(): Plugin {
  return {
    name: "agentation-scss-modules",
    enforce: "pre",
    // Re-key resolved stylesheets as JS modules so Vite's own CSS pipeline
    // leaves them alone.
    async resolveId(source, importer, options) {
      if (!source.endsWith(".scss")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved ? `\0${resolved.id}${SUFFIX}` : null;
    },
    async load(rawId) {
      if (!rawId.startsWith("\0") || !rawId.endsWith(SUFFIX)) return null;
      const id = rawId.slice(1, -SUFFIX.length);
      this.addWatchFile(id);
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
