// Mechanical first pass for porting React JSX to Vue JSX:
// - renames React-only attribute names to their DOM spelling
// - with --wrap-styles, wraps every `style={expr}` as `style={rs(expr)}` so
//   numeric values keep React's implicit "px" (see src/utils/react-style.ts)
// Logic (hooks, events) is ported by hand.
// Usage: node scripts/jsx-attrs.mjs <in.tsx> <out.tsx> [--wrap-styles]
import { readFileSync, writeFileSync } from "node:fs";

const SVG_ATTRS = [
  "strokeWidth", "strokeLinecap", "strokeLinejoin", "strokeDasharray", "strokeDashoffset",
  "strokeOpacity", "strokeMiterlimit", "fillRule", "fillOpacity", "clipRule", "clipPath",
  "stopColor", "stopOpacity", "textAnchor", "dominantBaseline", "fontSize", "fontWeight",
  "fontFamily", "colorInterpolationFilters", "floodOpacity", "floodColor", "vectorEffect",
  "shapeRendering", "maskType", "letterSpacing",
];
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

function wrapStyles(src) {
  let out = "";
  let i = 0;
  const needle = "style={";
  while (true) {
    const at = src.indexOf(needle, i);
    if (at === -1) break;
    // Only JSX attribute positions (preceded by whitespace)
    if (!/\s/.test(src[at - 1] ?? "")) {
      out += src.slice(i, at + needle.length);
      i = at + needle.length;
      continue;
    }
    const start = at + needle.length;
    let depth = 1;
    let j = start;
    let quote = null;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (quote) {
        if (c === "\\") j++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    const expr = src.slice(start, j - 1);
    out += src.slice(i, start) + (expr.trim().startsWith("rs(") ? expr : `rs(${expr})`) + "}";
    i = j;
  }
  return out + src.slice(i);
}

const [, , input, output, ...flags] = process.argv;
let src = readFileSync(input, "utf-8").replace(/\r\n/g, "\n");
src = src.replace(/^"use client";\n\n?/m, "");
src = src.replace(/\bclassName=/g, "class=");
src = src.replace(/\bhtmlFor=/g, "for=");
for (const attr of SVG_ATTRS) {
  // Only JSX attribute positions: preceded by whitespace and followed by `=`.
  src = src.replace(new RegExp(`(\\s)${attr}=`, "g"), `$1${kebab(attr)}=`);
}
src = src.replace(/React\.CSSProperties/g, "CSSProperties");
if (flags.includes("--wrap-styles")) src = wrapStyles(src);
writeFileSync(output, src);
