// One-off codemod: ports the body of upstream's PageFeedbackToolbarForRoute
// to a Vue setup() body that keeps React's hook semantics via
// src/composables/react-compat.ts.
//
// - `const [x, setX] = useState()` keeps its shape; reads of `x` become `x.value`
// - destructured props become `props.name`
// - derived render-time constants become `computed()`, reads become `.value`
// - `useCallback(fn, deps)` becomes `fn`, `useMemo(f, deps)` becomes `computed(f)`
// - effect dependency arrays become getters so they can be watched
// - render-time `ref.current = value` assignments become sync watchers
// - everything after the last hook moves into the returned render function
//
// Usage: node scripts/port-toolbar.mjs <upstream index.tsx> <out body.tsx>
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const [, , input, output] = process.argv;
const text = readFileSync(input, "utf-8").replace(/\r\n/g, "\n");
const host = ts.createCompilerHost({});
const origGet = host.getSourceFile;
host.getSourceFile = (name, lang) =>
  name === "/virtual.tsx"
    ? ts.createSourceFile(name, text, lang, true, ts.ScriptKind.TSX)
    : origGet(name, lang);
const program = ts.createProgram(["/virtual.tsx"], {
  jsx: ts.JsxEmit.Preserve, noResolve: true, noLib: true,
}, host);
const sf = program.getSourceFile("/virtual.tsx");
const checker = program.getTypeChecker();

const fn = sf.statements.find(
  (s) => ts.isFunctionDeclaration(s) && s.name?.text === "PageFeedbackToolbarForRoute",
);
const body = fn.body;
const HOOKS = new Set(["useState", "useEffect", "useLayoutEffect", "useCallback", "useMemo", "useRef", "useLatestAction"]);

const sym = (id) => checker.getSymbolAtLocation(id);
const stateSyms = new Set();
const derivedSyms = new Set();
const propSyms = new Map(); // symbol -> prop name

// Props
const param = fn.parameters[0];
for (const el of param.name.elements) {
  const s = sym(el.name);
  propSyms.set(s, (el.propertyName ?? el.name).text);
}

const calleeName = (expr) =>
  expr && ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) ? expr.expression.text : null;

const references = (node, set) => {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isIdentifier(n)) {
      const s = sym(n);
      if (s && (set.has(s) || propSyms.has(s) || derivedSyms.has(s))) found = true;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
};

// Last hook statement index: everything after it is render-only.
let lastHook = -1;
body.statements.forEach((st, i) => {
  let isHook = false;
  const visit = (n) => {
    if (ts.isFunctionLike(n) && n !== st) return;
    const c = calleeName(n);
    if (c && HOOKS.has(c)) isHook = true;
    ts.forEachChild(n, visit);
  };
  visit(st);
  if (isHook) lastHook = i;
});

// Collect states and derived values (setup part only)
const edits = []; // { start, end, text }
const edit = (start, end, t) => edits.push({ start, end, text: t });
const removed = [];
const remove = (start, end, t = "") => { removed.push([start, end]); edit(start, end, t); };

body.statements.forEach((st, i) => {
  if (!ts.isVariableStatement(st)) return;
  for (const decl of st.declarationList.declarations) {
    const init = decl.initializer;
    if (ts.isArrayBindingPattern(decl.name)) {
      const c = calleeName(init);
      if (c === "useState" || (init && ts.isIdentifier(init) && init.text === "activeState")) {
        const first = decl.name.elements[0];
        if (first && ts.isBindingElement(first)) stateSyms.add(sym(first.name));
      }
      continue;
    }
    if (!ts.isIdentifier(decl.name) || !init || i > lastHook) continue;
    const c = calleeName(init);
    if (c === "useCallback") {
      const f = init.arguments[0];
      edit(init.getStart(), f.getStart(), "");
      remove(f.getEnd(), init.getEnd());
      continue;
    }
    if (c === "useMemo") {
      derivedSyms.add(sym(decl.name));
      edit(init.getStart(), init.arguments[0].getStart(), "computed(");
      remove(init.arguments[0].getEnd(), init.getEnd(), ")");
      continue;
    }
    if (c && HOOKS.has(c)) continue;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) continue;
    if (references(init, stateSyms)) {
      derivedSyms.add(sym(decl.name));
      edit(init.getStart(), init.getStart(), "computed(() => ");
      edit(init.getEnd(), init.getEnd(), ")");
    }
  }
});

// Effect dependency arrays become getters
const visitEffects = (n) => {
  const c = calleeName(n);
  if ((c === "useEffect" || c === "useLayoutEffect") && n.arguments[1] && ts.isArrayLiteralExpression(n.arguments[1])) {
    edit(n.arguments[1].getStart(), n.arguments[1].getStart(), "() => ");
  }
  ts.forEachChild(n, visitEffects);
};
body.statements.slice(0, lastHook + 1).forEach(visitEffects);

// Render-time `x.current = value` statements
body.statements.slice(0, lastHook + 1).forEach((st) => {
  if (ts.isExpressionStatement(st) && ts.isBinaryExpression(st.expression) &&
      st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(st.expression.left) && st.expression.left.name.text === "current") {
    edit(st.getStart(), st.getStart(), "watchEffect(() => { ");
    edit(st.getEnd(), st.getEnd(), " }, { flush: \"sync\" });");
  }
});

// Reference rewriting
const visitRefs = (n) => {
  if (ts.isIdentifier(n)) {
    const parent = n.parent;
    // Skip declaration names and property names
    if ((ts.isBindingElement(parent) || ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === n) return;
    if (ts.isPropertyAccessExpression(parent) && parent.name === n) return;
    if (ts.isPropertyAssignment(parent) && parent.name === n) return;
    if (ts.isJsxAttribute(parent)) return;
    if (ts.isBindingElement(parent) && parent.propertyName === n) return;
    const s = sym(ts.isShorthandPropertyAssignment(parent) ? n : n);
    const target = ts.isShorthandPropertyAssignment(parent) ? checker.getShorthandAssignmentValueSymbol(parent) : s;
    if (!target) return;
    let replacement = null;
    if (stateSyms.has(target) || derivedSyms.has(target)) replacement = `${n.text}.value`;
    else if (propSyms.has(target)) replacement = `props.${propSyms.get(target)}`;
    if (replacement) {
      if (ts.isShorthandPropertyAssignment(parent)) edit(n.getStart(), n.getEnd(), `${n.text}: ${replacement}`);
      else edit(n.getStart(), n.getEnd(), replacement);
    }
    return;
  }
  ts.forEachChild(n, visitRefs);
};
body.statements.forEach(visitRefs);

// Render function
const renderStart = body.statements[lastHook + 1].getFullStart();
edit(renderStart, renderStart, "\n\n  return () => {");
edit(body.statements.at(-1).getEnd(), body.statements.at(-1).getEnd(), "\n  };");

// Drop edits inside removed ranges
for (let k = edits.length - 1; k >= 0; k--) {
  const e = edits[k];
  if (removed.some(([a, b]) => e.start >= a && e.end <= b && !(e.start === a && e.end === b))) edits.splice(k, 1);
}

// Apply edits (sorted, stable for same position)
const bodyStart = body.getStart() + 1;
const bodyEnd = body.getEnd() - 1;
edits.forEach((e, i) => (e.i = i));
edits.sort((a, b) => b.start - a.start || b.end - a.end || b.i - a.i);
let out = text;
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
const delta = edits.reduce((acc, e) => acc + e.text.length - (e.end - e.start), 0);
writeFileSync(output, out.slice(bodyStart, bodyEnd + delta));
console.log(`states ${stateSyms.size}, derived ${derivedSyms.size}, props ${propSyms.size}, lastHook ${lastHook}/${body.statements.length}, edits ${edits.length}`);
console.log("derived:", [...derivedSyms].map((s) => s.name).join(", "));
