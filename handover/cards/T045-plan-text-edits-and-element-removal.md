# T045: Plan text edits and element removal

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T045 (build), phase 5 |
| Depends on | T009 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `src/engine/html/edit.ts`, `tests/engine/html-edit.test.ts`

**Modify:** none

**Read only:** `src/engine/html/select.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T045`):

1. `npx vitest run tests/engine/html-edit.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`planEditText` and `planRemoveElement` return HTML TextEdits; `indentOf`, `requireNode` and `escapeText` are shared helpers for the structure planners.

## Context

Engine module, HTML area. Double-click text editing and Delete use these through the element group (T047). Pure functions: no I/O. Edits always target the original HTML text by offset, so the rest of the file keeps its exact formatting.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export interface PageModel {
  file: string;
  title: string;            // <title> text trimmed, or file name without ".html" when missing/empty
  /** href of every <link rel="stylesheet"> that is relative (no scheme, not "/" or "//"), "?"/"#" parts and a leading "./" removed. */
  stylesheets: string[];
  body: ElementNode;        // path ""
  /** css-select `is(node, selector)` for the element at path (exceptions → false); null if path is missing. */
  matcher(path: ElementPath): ElementMatcher | null;
}
/** Replace innerRange with the escaped text (& → &amp;, < → &lt;, > → &gt;). ELEMENT_NOT_FOUND; NOT_TEXT_ELEMENT unless kind is text/link with innerRange. */
export type PlanEditText = (page: PageModel, path: ElementPath, text: string) => TextEdit[];
/** Remove range; start moves back to the preceding "\n" when only spaces/tabs separate them. Path "" → INVALID_INPUT. */
export type PlanRemoveElement = (page: PageModel, html: string, path: ElementPath) => TextEdit[];
```

```ts
// src/contracts/model.ts
export interface ElementNode {
  path: ElementPath;
  tag: string;                       // lowercase
  /** Only these attributes, when present: id, class, src, alt, href, data-mason-name. */
  attrs: Record<string, string>;
  classes: string[];                 // class attribute split on whitespace, empty strings removed
  name: string;                      // friendlyName(...)
  kind: LayerKind;                   // layerKind(...)
  /** Whitespace-collapsed, trimmed text content for kind "text" | "link"; cut to 80 chars + "…". Else null. */
  text: string | null;
  children: ElementNode[];
  range: SourceRange;                // whole element including start and end tag
  innerRange: SourceRange | null;    // from end of start tag to start of end tag; null for void elements
}
export interface TextEdit { file: string; start: number; end: number; text: string }
```

## Current state

`src/engine/html/select.ts` exports `findNode(body, path)`. Element nodes carry `range` and `innerRange` (null for void elements).

## Steps

1. Create `src/engine/html/edit.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { ElementNode, ElementPath, TextEdit } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import { findNode } from "./select.ts";

/** Spaces/tabs between the start of node's line and node.range.start; "" when other text is there. */
export function indentOf(html: string, node: ElementNode): string {
  const lineStart = html.lastIndexOf("\n", node.range.start - 1) + 1;
  const ws = html.slice(lineStart, node.range.start);
  return /^[ \t]*$/.test(ws) ? ws : "";
}

/** The node at path, or ELEMENT_NOT_FOUND. */
export function requireNode(page: PageModel, path: ElementPath): ElementNode {
  const node = findNode(page.body, path);
  if (!node) throw new MasonError("ELEMENT_NOT_FOUND", path);
  return node;
}

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** See PlanEditText in src/contracts/engine.ts. */
export function planEditText(page: PageModel, path: ElementPath, text: string): TextEdit[] {
  const node = requireNode(page, path);
  if ((node.kind !== "text" && node.kind !== "link") || !node.innerRange) throw new MasonError("NOT_TEXT_ELEMENT", path);
  return [{ file: page.file, start: node.innerRange.start, end: node.innerRange.end, text: escapeText(text) }];
}

/** See PlanRemoveElement in src/contracts/engine.ts. */
export function planRemoveElement(page: PageModel, html: string, path: ElementPath): TextEdit[] {
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be removed.");
  const node = requireNode(page, path);
  let k = node.range.start;
  while (k > 0 && (html[k - 1] === " " || html[k - 1] === "\t")) k -= 1;
  const start = k > 0 && html[k - 1] === "\n" ? k - 1 : node.range.start;
  return [{ file: page.file, start, end: node.range.end, text: "" }];
}
```

2. Create `tests/engine/html-edit.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { escapeText, indentOf, planEditText, planRemoveElement } from "../../src/engine/html/edit.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { findNode } from "../../src/engine/html/select.ts";
import type { PlanEditText, PlanRemoveElement } from "../../src/contracts/engine.ts";

const _t: [PlanEditText, PlanRemoveElement] = [planEditText, planRemoveElement];
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const page = parsePage("index.html", html);

describe("text and remove planners", () => {
  it("measures the indent of an element's line", () => {
    expect(indentOf(html, findNode(page.body, "1.0.0.1")!)).toBe("        ");
    expect(indentOf(html, findNode(page.body, "1.1.1.0.1")!)).toBe("");
  });
  it("replaces the inner text of a text element, escaped", () => {
    expect(escapeText("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
    const out = applyTextEdits(html, planEditText(page, "1.0.0.1", "Beans & more"));
    expect(out).toContain('<h1 class="headline">Beans &amp; more</h1>');
  });
  it("refuses text edits on containers and missing paths", () => {
    expect(() => planEditText(page, "1.0", "x")).toThrow("Only text elements can be edited as text.");
    expect(() => planEditText(page, "1.7", "x")).toThrow("Element not found.");
  });
  it("removes an element together with its line indent", () => {
    const out = applyTextEdits(html, planRemoveElement(page, html, "1.0.0.0"));
    expect(out).toContain('<div class="hero-copy">\n        <h1 class="headline">');
    expect(out).not.toContain("eyebrow");
  });
  it("refuses to remove the body", () => {
    expect(() => planRemoveElement(page, html, "")).toThrow("Invalid input.");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN text is edited THE SYSTEM SHALL replace the element's inner range with the escaped text. (test: "replaces the inner text of a text element, escaped")
- IF the element is not text or link THEN THE SYSTEM SHALL throw NOT_TEXT_ELEMENT. (test: "refuses text edits on containers and missing paths")
- WHEN an element is removed THE SYSTEM SHALL remove its line indent and the newline before it. (test: "removes an element together with its line indent")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T045`.
The last line must be `GATE PASS T045`. On `GATE FAIL T045 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T045` prints `GATE PASS T045`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T045: Plan text edits and element removal
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
