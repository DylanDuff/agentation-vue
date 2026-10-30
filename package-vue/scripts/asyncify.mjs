// Marks functions that contain `await` as async and awaits calls to named
// helpers that became async, repeating until stable. Usage: node asyncify.mjs file...
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

for (const file of process.argv.slice(2)) {
  for (let round = 0; round < 10; round++) {
    const text = readFileSync(file, "utf-8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    const asyncNames = new Set();
    const enclosingFn = (n) => { let p = n.parent; while (p && !ts.isFunctionLike(p)) p = p.parent; return p; };
    const isAsync = (fn) => fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    const fnName = (fn) => {
      if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
      if (fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text;
      return null;
    };
    const visit = (n) => {
      if (ts.isAwaitExpression(n)) {
        const fn = enclosingFn(n);
        if (fn && !isAsync(fn) && !edits.some((e) => e.fn === fn)) {
          edits.push({ fn, pos: fn.getStart(), text: "async " });
        }
      }
      if (ts.isFunctionLike(n) && isAsync(n)) { const name = fnName(n); if (name) asyncNames.add(name); }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    for (const e of edits) { const name = fnName(e.fn); if (name) asyncNames.add(name); }
    const callVisit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && asyncNames.has(n.expression.text) &&
          !ts.isAwaitExpression(n.parent) && !(ts.isReturnStatement(n.parent))) {
        edits.push({ pos: n.getStart(), text: "await " });
      }
      ts.forEachChild(n, callVisit);
    };
    callVisit(sf);
    if (!edits.length) break;
    edits.sort((a, b) => b.pos - a.pos);
    let out = text;
    for (const e of edits) out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
    writeFileSync(file, out);
  }
}
