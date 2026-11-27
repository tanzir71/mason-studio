# T046: Plan inserting, moving and wrapping elements

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T046 (build), phase 5 |
| Depends on | T045, T035 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `src/engine/html/structure.ts`, `tests/engine/html-structure.test.ts`

**Modify:** none

**Read only:** `src/engine/html/edit.ts`, `src/engine/html/select.ts`, `src/engine/css/edits.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T046`):

1. `npx vitest run tests/engine/html-structure.test.ts` -> exit 0, output contains `Tests  7 passed (7)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`planInsertElement`, `planMoveElement` and `planWrapInStack` return the HTML and CSS edits for structural changes, following the contract exactly.

## Context

Engine module, HTML area. Inserted elements get a free class (`rect-1`, `text-2`…) and a starter rule appended to the page's last stylesheet, so the layer has a friendly name and is editable at once. Pure functions: no I/O. Edits always target the original HTML text by offset, so the rest of the file keeps its exact formatting.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export const INSERT_SNIPPETS: Record<InsertKind, string> = {
  frame: '<div class="{cls}"></div>', rect: '<div class="{cls}"></div>', ellipse: '<div class="{cls}"></div>',
  text: '<p class="{cls}">Text</p>', image: '<img class="{cls}" src="" alt="">',
};
export const INSERT_STYLES: Record<InsertKind, [string, string][]> = {
  frame: [["display", "flex"], ["flex-direction", "column"], ["gap", "16px"], ["padding", "24px"], ["min-height", "120px"]],
  rect: [["width", "160px"], ["height", "120px"], ["background-color", "#d9d9d9"]],
  ellipse: [["width", "120px"], ["height", "120px"], ["border-radius", "50%"], ["background-color", "#d9d9d9"]],
  text: [["font-size", "16px"]],
  image: [["width", "240px"], ["height", "160px"], ["object-fit", "cover"]],
};
export interface InsertPlan { edits: TextEdit[]; className: string; path: ElementPath }
/**
 * planInsertElement(page, html, css, parentPath, index, kind): cls = nextClassName(body, kind); snippet =
 * INSERT_SNIPPETS[kind] with "{cls}" replaced. index is clamped to [0, element children count].
 * indent(node) = spaces/tabs between the line start and node.range.start ("" when other text is there).
 * - index < count: insert `${snippet}\n${indent(child)}` at children[index].range.start.
 * - index === count > 0: insert `\n${indent(last)}${snippet}` at last.range.end.
 * - no children: p = indent(parent); if innerRange text is whitespace only replace innerRange with
 *   `\n${p}  ${snippet}\n${p}`, else insert that text at innerRange.end.
 * css: { file, text } of the page's last stylesheet, or null → throw NO_STYLESHEET. Adds
 * planAppendRule(css.file, css.text, "." + cls, INSERT_STYLES[kind]). Parent without innerRange → INVALID_INPUT.
 * path = parentPath === "" ? String(index) : `${parentPath}.${index}` (after clamping).
 */
export type PlanInsertElement = (page: PageModel, html: string, css: { file: string; text: string } | null,
  parentPath: ElementPath, index: number, kind: InsertKind) => InsertPlan;
/**
 * planMoveElement(page, html, path, toIndex): reorder within the same parent. from = last path segment;
 * to = toIndex clamped to [0, siblings - 1]; from === to → { edits: [], path }. Edits: the removal from
 * planRemoveElement plus an insertion of html.slice(range): to < from → `${text}\n${indent(sib)}` at
 * siblings[to].range.start; to > from → `\n${indent(sib)}${text}` at siblings[to].range.end.
 * Returns { edits sorted by start, path: parent path + to }.
 */
export type PlanMoveElement = (page: PageModel, html: string, path: ElementPath, toIndex: number) => { edits: TextEdit[]; path: ElementPath };
/**
 * planWrapInStack(page, html, css, path): cls = nextClassName(body, "stack"); insert `<div class="${cls}">` at
 * range.start and `</div>` at range.end; append `.${cls}` with display: flex; flex-direction: column; gap: 16px.
 * Path "" → INVALID_INPUT; css null → NO_STYLESHEET. Result path = path (the wrapper takes the element's place).
 */
export type PlanWrapInStack = (page: PageModel, html: string, css: { file: string; text: string } | null, path: ElementPath) => InsertPlan;
```

## Current state

`src/engine/html/edit.ts` exports `indentOf`, `requireNode`, `planRemoveElement`. `src/engine/html/select.ts` exports `nextClassName`. `src/engine/css/edits.ts` exports `planAppendRule`.

## Steps

1. Create `src/engine/html/structure.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { INSERT_SNIPPETS, INSERT_STYLES } from "../../contracts/engine.ts";
import type { InsertPlan, PageModel } from "../../contracts/engine.ts";
import type { ElementPath, InsertKind, TextEdit } from "../../contracts/model.ts";
import { planAppendRule } from "../css/edits.ts";
import { indentOf, planRemoveElement, requireNode } from "./edit.ts";
import { nextClassName } from "./select.ts";

const childPath = (parent: ElementPath, i: number): ElementPath => (parent === "" ? String(i) : `${parent}.${i}`);
const parentOf = (path: ElementPath): ElementPath => (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "");
const byStart = (a: TextEdit, b: TextEdit) => a.start - b.start;

/** See PlanInsertElement in src/contracts/engine.ts. */
export function planInsertElement(page: PageModel, html: string, css: { file: string; text: string } | null,
  parentPath: ElementPath, index: number, kind: InsertKind): InsertPlan {
  if (!(kind in INSERT_SNIPPETS)) throw new MasonError("INVALID_INPUT", kind);
  const parent = requireNode(page, parentPath);
  if (!parent.innerRange) throw new MasonError("INVALID_INPUT", parentPath);
  if (!css) throw new MasonError("NO_STYLESHEET", page.file);
  const className = nextClassName(page.body, kind);
  const snippet = INSERT_SNIPPETS[kind].replace("{cls}", className);
  const count = parent.children.length;
  const idx = Math.min(Math.max(Math.trunc(index), 0), count);
  let edit: TextEdit;
  if (idx < count) {
    const child = parent.children[idx];
    edit = { file: page.file, start: child.range.start, end: child.range.start, text: `${snippet}\n${indentOf(html, child)}` };
  } else if (count > 0) {
    const last = parent.children[count - 1];
    edit = { file: page.file, start: last.range.end, end: last.range.end, text: `\n${indentOf(html, last)}${snippet}` };
  } else {
    const p = indentOf(html, parent);
    const inner = html.slice(parent.innerRange.start, parent.innerRange.end);
    const text = `\n${p}  ${snippet}\n${p}`;
    edit = /^\s*$/.test(inner)
      ? { file: page.file, start: parent.innerRange.start, end: parent.innerRange.end, text }
      : { file: page.file, start: parent.innerRange.end, end: parent.innerRange.end, text };
  }
  const rule = planAppendRule(css.file, css.text, `.${className}`, INSERT_STYLES[kind]);
  return { edits: [edit, rule], className, path: childPath(parentPath, idx) };
}

/** See PlanMoveElement in src/contracts/engine.ts. */
export function planMoveElement(page: PageModel, html: string, path: ElementPath, toIndex: number): { edits: TextEdit[]; path: ElementPath } {
  const node = requireNode(page, path);
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be moved.");
  const parentPath = parentOf(path);
  const siblings = requireNode(page, parentPath).children;
  const from = Number(path.slice(path.lastIndexOf(".") + 1));
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), siblings.length - 1);
  if (from === to) return { edits: [], path };
  const text = html.slice(node.range.start, node.range.end);
  const sib = siblings[to];
  const insert: TextEdit = to < from
    ? { file: page.file, start: sib.range.start, end: sib.range.start, text: `${text}\n${indentOf(html, sib)}` }
    : { file: page.file, start: sib.range.end, end: sib.range.end, text: `\n${indentOf(html, sib)}${text}` };
  return { edits: [...planRemoveElement(page, html, path), insert].sort(byStart), path: childPath(parentPath, to) };
}

/** See PlanWrapInStack in src/contracts/engine.ts. */
export function planWrapInStack(page: PageModel, html: string, css: { file: string; text: string } | null, path: ElementPath): InsertPlan {
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be wrapped.");
  const node = requireNode(page, path);
  if (!css) throw new MasonError("NO_STYLESHEET", page.file);
  const className = nextClassName(page.body, "stack");
  const edits: TextEdit[] = [
    { file: page.file, start: node.range.start, end: node.range.start, text: `<div class="${className}">` },
    { file: page.file, start: node.range.end, end: node.range.end, text: "</div>" },
    planAppendRule(css.file, css.text, `.${className}`, [["display", "flex"], ["flex-direction", "column"], ["gap", "16px"]]),
  ];
  return { edits, className, path };
}
```

2. Create `tests/engine/html-structure.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planInsertElement, planMoveElement, planWrapInStack } from "../../src/engine/html/structure.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanInsertElement, PlanMoveElement, PlanWrapInStack } from "../../src/contracts/engine.ts";

const _t: [PlanInsertElement, PlanMoveElement, PlanWrapInStack] = [planInsertElement, planMoveElement, planWrapInStack];
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const page = parsePage("index.html", html);
const css = { file: "styles.css", text: "a {}\n" };
const htmlOf = (edits: { file: string; start: number; end: number; text: string }[]) => applyTextEdits(html, edits.filter((e) => e.file === "index.html"));

describe("planInsertElement", () => {
  it("inserts before an existing child with its indent and appends the rule", () => {
    const plan = planInsertElement(page, html, css, "1.0.0", 1, "rect");
    expect([plan.className, plan.path]).toEqual(["rect-1", "1.0.0.1"]);
    expect(htmlOf(plan.edits)).toContain('<p class="eyebrow">Roasted on Tuesdays</p>\n        <div class="rect-1"></div>\n        <h1 class="headline">');
    expect(plan.edits[1]).toEqual({ file: "styles.css", start: 5, end: 5, text: ".rect-1 {\n  width: 160px;\n  height: 120px;\n  background-color: #d9d9d9;\n}\n" });
  });
  it("appends after the last child and clamps the index", () => {
    const plan = planInsertElement(page, html, css, "1.0.0", 99, "text");
    expect(plan.path).toBe("1.0.0.4");
    expect(htmlOf(plan.edits)).toContain("Order this week's beans</a>\n        <p class=\"text-1\">Text</p>\n      </div>");
  });
  it("fills an empty element", () => {
    const empty = "<html><body>\n  <main>\n  </main>\n</body></html>";
    const p = parsePage("a.html", empty);
    const plan = planInsertElement(p, empty, css, "0", 0, "frame");
    expect(applyTextEdits(empty, plan.edits.filter((e) => e.file === "a.html"))).toBe('<html><body>\n  <main>\n    <div class="frame-1"></div>\n  </main>\n</body></html>');
  });
  it("needs a stylesheet and a parent with content", () => {
    expect(() => planInsertElement(page, html, null, "1", 0, "rect")).toThrow("This page has no local stylesheet.");
    expect(() => planInsertElement(page, html, css, "1.0.1", 0, "rect")).toThrow("Invalid input.");
  });
});

describe("planMoveElement and planWrapInStack", () => {
  it("moves an element down and up among its siblings", () => {
    const down = planMoveElement(page, html, "1.0.0.0", 2);
    expect(down.path).toBe("1.0.0.2");
    expect(applyTextEdits(html, down.edits)).toContain('<h1 class="headline">Small-batch coffee, roasted down the street.</h1>\n        <p class="lede">We roast twice a week in a 12-kilo drum and deliver by bike across the city.</p>\n        <p class="eyebrow">');
    const up = planMoveElement(page, html, "1.0.0.3", 0);
    expect(up.path).toBe("1.0.0.0");
    expect(applyTextEdits(html, up.edits)).toContain('<div class="hero-copy">\n        <a class="order-button" href="#order">Order this week\'s beans</a>\n        <p class="eyebrow">');
  });
  it("returns no edits when the index does not change", () => {
    expect(planMoveElement(page, html, "1.0.0.1", 1)).toEqual({ edits: [], path: "1.0.0.1" });
  });
  it("wraps an element in a new stack", () => {
    const plan = planWrapInStack(page, html, css, "1.0.0.3");
    expect(plan.className).toBe("stack-1");
    expect(htmlOf(plan.edits)).toContain('<div class="stack-1"><a class="order-button" href="#order">Order this week\'s beans</a></div>');
    expect(plan.edits[2].text).toBe(".stack-1 {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN inserting before a child THE SYSTEM SHALL insert the snippet plus newline and indent at the child's start, and append the class rule. (test: "inserts before an existing child with its indent and appends the rule")
- WHEN moving an element THE SYSTEM SHALL remove it and insert its text next to the target sibling. (test: "moves an element down and up among its siblings")
- WHEN wrapping THE SYSTEM SHALL surround the element with a new stack div and append its flex rule. (test: "wraps an element in a new stack")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T046`.
The last line must be `GATE PASS T046`. On `GATE FAIL T046 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T046` prints `GATE PASS T046`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T046: Plan inserting, moving and wrapping elements
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
