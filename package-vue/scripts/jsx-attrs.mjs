// Mechanical first pass for porting React JSX to Vue JSX: renames React-only
// attribute names to their DOM spelling. Logic (hooks, events) is ported by hand.
// Usage: node scripts/jsx-attrs.mjs <in.tsx> <out.tsx>
import { readFileSync, writeFileSync } from "node:fs";

const SVG_ATTRS = [
  "strokeWidth", "strokeLinecap", "strokeLinejoin", "strokeDasharray", "strokeDashoffset",
  "strokeOpacity", "strokeMiterlimit", "fillRule", "fillOpacity", "clipRule", "clipPath",
  "stopColor", "stopOpacity", "textAnchor", "dominantBaseline", "fontSize", "fontWeight",
  "fontFamily", "colorInterpolationFilters", "floodOpacity", "floodColor", "vectorEffect",
  "shapeRendering", "maskType", "letterSpacing",
];
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

const [, , input, output] = process.argv;
let src = readFileSync(input, "utf-8");
src = src.replace(/^"use client";\n\n?/m, "");
src = src.replace(/\bclassName=/g, "class=");
src = src.replace(/\bhtmlFor=/g, "for=");
for (const attr of SVG_ATTRS) {
  // Only JSX attribute positions: preceded by whitespace and followed by `=`.
  src = src.replace(new RegExp(`(\\s)${attr}=`, "g"), `$1${kebab(attr)}=`);
}
src = src.replace(/React\.CSSProperties/g, "CSSProperties");
writeFileSync(output, src);
