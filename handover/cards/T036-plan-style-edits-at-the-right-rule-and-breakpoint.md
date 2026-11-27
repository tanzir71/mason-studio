# T036: Plan style edits at the right rule and breakpoint

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T036 (build), phase 4 |
| Depends on | T034, T035 |
| Effort | max |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19 |

**Create:** `src/engine/css/plan-style.ts`, `tests/engine/plan-style.test.ts`

**Modify:** none

**Read only:** `src/engine/css/cascade.ts`, `src/engine/css/edits.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T036`):

1. `npx vitest run tests/engine/plan-style.test.ts` -> exit 0, output contains `Tests  10 passed (10)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`planStyleEdit` returns the TextEdits that make `prop: value` win for an element at a scope, editing the winning rule or the matching `@media` rule in place.

## Context

Engine module, CSS area. This is Mason's core promise: "All sizes" edits the base rule that already sets the value; "≤ 768" / "≤ 375" edit or create the override inside `@media (max-width: …)` next to the base rule, never inline styles. Follow the contract algorithm step by step; the code below implements it exactly. Pure function: no I/O, no global state. Inputs are never mutated.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export interface PlanStyleInput {
  sheets: CssSheet[]; el: ElementMatcher; elementSelector: string;
  prop: string; value: string; scope: Scope; defaultFile: string;
}
/**
 * planStyleEdit(input): TextEdits that make `prop: value` win for the element at the scope's width.
 * Throws INVALID_INPUT when value is empty after trim or contains ";", "{" or "}".
 * Scope "all" (width 1280):
 *   1. If resolveCascade(...) has a winning entry: replace its declaration.valueRange with value.
 *   2. Else if matchingRules(...) has an applying rule with media null: insert the declaration into the first one.
 *   3. Else append `${elementSelector} {\n  ${prop}: ${value};\n}\n` to defaultFile (see "Append" below).
 * Scope "tablet"/"mobile" (width W, M = `(max-width: ${maxWidth}px)`):
 *   1. If an applying cascade entry has rule.media === M: replace the value of the first such entry.
 *   2. Else if an applying matching rule has rule.media === M: insert the declaration into the first such rule.
 *   3. Else let base = first applying cascade entry with rule.media null; sel = base?.selector ?? elementSelector;
 *      file = base?.rule.file ?? defaultFile. If that sheet has a mediaBlock with media === M whose bodyEnd is
 *      greater than base.rule.range.end (or any such block when base is undefined), insert
 *      `  ${sel} {\n    ${prop}: ${value};\n  }\n` at the LAST such block's bodyEnd (prefix "\n" when the
 *      character before bodyEnd is not "\n"). Otherwise append
 *      `\n@media (max-width: ${maxWidth}px) {\n  ${sel} {\n    ${prop}: ${value};\n  }\n}\n` (see "Append").
 * Insert a declaration into rule R:
 *   - Single-line rule (no "\n" inside bodyRange): one edit at lastDecl.range.end with text
 *     (lastDecl text ends with ";" ? "" : ";") + ` ${prop}: ${value};`; with no declarations replace bodyRange
 *     with ` ${prop}: ${value}; `.
 *   - Multi-line rule: indent = whitespace between the line start and the first declaration (if it is only
 *     spaces/tabs) else "  "; one edit at (lastDecl?.range.end ?? bodyRange.start) with text
 *     (lastDecl && !lastDecl text ends with ";" ? ";" : "") + `\n${indent}${prop}: ${value};`.
 * Append to file F: one edit at F's text length; text starts with "\n" when F's text does not end with "\n".
 * Always returns edits sorted by start ascending.
 */
export type PlanStyleEdit = (input: PlanStyleInput) => TextEdit[];
```

```ts
// src/contracts/model.ts
/** Fixed breakpoint row shown for every page, in this order. */
export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 768, maxWidth: 768 },
  { id: "mobile", label: "Mobile", width: 375, maxWidth: 375 },
];
export interface TextEdit { file: string; start: number; end: number; text: string }
export interface CssRule {
  file: string;
  index: number;         // order of appearance among the sheet's collected rules (0-based)
  selector: string;      // selector list as written, trimmed
  media: string | null;  // normalized params of the enclosing @media (lowercase, single spaces), null at top level
  line: number;          // 1-based line of the selector
  declarations: CssDeclaration[];
  range: SourceRange;    // selector start to closing "}" inclusive
```

## Current state

`src/engine/css/cascade.ts` exports `matchingRules`, `resolveCascade`; `src/engine/css/edits.ts` exports `appendEdit(file, text, addition)`.

## Steps

1. Create `src/engine/css/plan-style.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS } from "../../contracts/model.ts";
import type { CssRule, CssSheet, TextEdit } from "../../contracts/model.ts";
import type { PlanStyleInput } from "../../contracts/engine.ts";
import { matchingRules, resolveCascade } from "./cascade.ts";
import { appendEdit } from "./edits.ts";

/** `(max-width: Npx)` and the evaluation width for a tablet/mobile scope. */
export function scopeMedia(scope: "tablet" | "mobile"): { media: string; width: number; maxWidth: number } {
  const bp = BREAKPOINTS.find((b) => b.id === scope)!;
  return { media: `(max-width: ${bp.maxWidth}px)`, width: bp.width, maxWidth: bp.maxWidth! };
}

/** Insert `prop: value;` into rule R (see "Insert a declaration" in PlanStyleEdit). */
export function insertDeclaration(text: string, rule: CssRule, prop: string, value: string): TextEdit {
  const file = rule.file;
  const body = text.slice(rule.bodyRange.start, rule.bodyRange.end);
  const decls = rule.declarations;
  const last = decls[decls.length - 1];
  const lastText = last ? text.slice(last.range.start, last.range.end) : "";
  if (!body.includes("\n")) {
    if (!last) return { file, start: rule.bodyRange.start, end: rule.bodyRange.end, text: ` ${prop}: ${value}; ` };
    return { file, start: last.range.end, end: last.range.end, text: (lastText.endsWith(";") ? "" : ";") + ` ${prop}: ${value};` };
  }
  let indent = "  ";
  if (decls[0]) {
    const lineStart = text.lastIndexOf("\n", decls[0].range.start - 1) + 1;
    const ws = text.slice(lineStart, decls[0].range.start);
    if (/^[ \t]*$/.test(ws)) indent = ws;
  }
  const at = last ? last.range.end : rule.bodyRange.start;
  return { file, start: at, end: at, text: (last && !lastText.endsWith(";") ? ";" : "") + `\n${indent}${prop}: ${value};` };
}

/** See PlanStyleEdit in src/contracts/engine.ts. */
export function planStyleEdit(input: PlanStyleInput): TextEdit[] {
  const { sheets, el, elementSelector, prop, scope, defaultFile } = input;
  const value = input.value.trim();
  if (value === "" || /[;{}]/.test(value)) throw new MasonError("INVALID_INPUT", input.value);
  const textOf = (file: string): string => sheets.find((s) => s.file === file)?.text ?? "";
  const replace = (file: string, start: number, end: number): TextEdit[] => [{ file, start, end, text: value }];

  if (scope === "all") {
    const win = resolveCascade(sheets, el, prop, 1280).find((e) => e.winning);
    if (win) return replace(win.rule.file, win.declaration.valueRange.start, win.declaration.valueRange.end);
    const base = matchingRules(sheets, el, 1280).find((m) => m.applies && m.rule.media === null);
    if (base) return [insertDeclaration(textOf(base.rule.file), base.rule, prop, value)];
    return [appendEdit(defaultFile, textOf(defaultFile), `${elementSelector} {\n  ${prop}: ${value};\n}\n`)];
  }

  const { media: M, width, maxWidth } = scopeMedia(scope);
  const cascade = resolveCascade(sheets, el, prop, width);
  const inM = cascade.find((e) => e.applies && e.rule.media === M);
  if (inM) return replace(inM.rule.file, inM.declaration.valueRange.start, inM.declaration.valueRange.end);
  const ruleM = matchingRules(sheets, el, width).find((m) => m.applies && m.rule.media === M);
  if (ruleM) return [insertDeclaration(textOf(ruleM.rule.file), ruleM.rule, prop, value)];

  const base = cascade.find((e) => e.applies && e.rule.media === null);
  const sel = base?.selector ?? elementSelector;
  const file = base?.rule.file ?? defaultFile;
  const sheet: CssSheet | undefined = sheets.find((s) => s.file === file);
  const text = sheet?.text ?? "";
  const blocks = (sheet?.mediaBlocks ?? []).filter((b) => b.media === M && (!base || b.bodyEnd > base.rule.range.end));
  const block = blocks[blocks.length - 1];
  if (block) {
    const prefix = text[block.bodyEnd - 1] === "\n" ? "" : "\n";
    return [{ file, start: block.bodyEnd, end: block.bodyEnd, text: `${prefix}  ${sel} {\n    ${prop}: ${value};\n  }\n` }];
  }
  return [appendEdit(file, text, `\n@media (max-width: ${maxWidth}px) {\n  ${sel} {\n    ${prop}: ${value};\n  }\n}\n`)];
}
```

2. Create `tests/engine/plan-style.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planStyleEdit } from "../../src/engine/css/plan-style.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanStyleEdit } from "../../src/contracts/engine.ts";
import type { Scope } from "../../src/contracts/model.ts";

const _t: PlanStyleEdit = planStyleEdit;
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const fixture = readFileSync("tests/fixtures/northfield/styles.css", "utf8");

function run(css: string, path: string, prop: string, value: string, scope: Scope, selector = ".x"): string {
  const sheet = parseStylesheet("styles.css", css);
  const edits = planStyleEdit({ sheets: [sheet], el: page.matcher(path)!, elementSelector: selector, prop, value, scope, defaultFile: "styles.css" });
  return applyTextEdits(css, edits);
}

describe("planStyleEdit for all sizes", () => {
  it("replaces the winning value", () => {
    const out = run(fixture, "1.0.0.1", "font-size", "44px", "all");
    expect(out).toContain(".hero h1 {\n  font-family: var(--font-display);\n  font-size: 44px;");
    expect(out).toContain("@media (max-width: 768px) {\n  .hero {\n    grid-template-columns: 1fr;\n    padding: 40px 32px;\n  }\n  .hero h1 {\n    font-size: 32px;");
  });
  it("inserts into the first applying base rule of a multi-line rule with its indent", () => {
    const out = run(fixture, "1.0.0.1", "margin", "0", "all");
    expect(out).toContain("  color: #1e2a22;\n  margin: 0;\n}");
  });
  it("inserts into a single-line rule", () => {
    expect(run(fixture, "1.0.0.2", "margin", "0 0 16px", "all")).toContain(".lede { font-size: 17px; color: #4a544c; margin: 0 0 16px; }");
  });
  it("appends a new rule when no rule matches", () => {
    expect(run("a { color: red; }", "1.0.0.0", "margin", "0", "all", ".eyebrow-x")).toBe("a { color: red; }\n.eyebrow-x {\n  margin: 0;\n}\n");
  });
  it("rejects empty values and values with ; { }", () => {
    expect(() => run(fixture, "1.0.0.1", "color", "  ", "all")).toThrow("Invalid input.");
    expect(() => run(fixture, "1.0.0.1", "color", "red; x: y", "all")).toThrow("Invalid input.");
  });
});

describe("planStyleEdit for tablet and mobile", () => {
  it("replaces an existing override in the matching media rule", () => {
    const out = run(fixture, "1.0.0.1", "font-size", "30px", "tablet");
    expect(out).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
    expect(out).toContain(".hero h1 {\n  font-family: var(--font-display);\n  font-size: 40px;");
  });
  it("inserts into a matching rule inside the media block", () => {
    expect(run(fixture, "1.0.0.1", "line-height", "1.1", "tablet")).toContain("  .hero h1 {\n    font-size: 32px;\n    line-height: 1.1;\n  }");
    expect(run(fixture, "1.0.0.1", "margin", "0", "mobile")).toContain("  .hero h1 { font-size: 28px; margin: 0; }");
  });
  it("adds a rule to the last media block after the base rule", () => {
    const out = run(fixture, "1.0.0.2", "font-size", "15px", "tablet");
    expect(out).toContain("  .hero h1 {\n    font-size: 32px;\n  }\n  .lede {\n    font-size: 15px;\n  }\n}\n\n@media (max-width: 375px)");
  });
  it("appends a new media block when none follows the base rule", () => {
    const css = "@media (max-width: 768px) {\n  .x { color: red; }\n}\n.lede { font-size: 17px; }\n";
    expect(run(css, "1.0.0.2", "font-size", "15px", "tablet")).toBe(css + "\n@media (max-width: 768px) {\n  .lede {\n    font-size: 15px;\n  }\n}\n");
  });
  it("uses the element selector when no base rule sets the property", () => {
    expect(run("p { color: red; }\n", "1.0.0.2", "gap", "4px", "mobile", ".lede")).toBe("p { color: red; }\n\n@media (max-width: 375px) {\n  .lede {\n    gap: 4px;\n  }\n}\n");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN scope is all and a value wins THE SYSTEM SHALL replace only that value. (test: "replaces the winning value")
- WHEN no rule sets the property THE SYSTEM SHALL insert into the first applying base rule, keeping single-line and multi-line formatting. (test: "inserts into a single-line rule")
- WHEN scope is tablet and an override exists THE SYSTEM SHALL replace it and leave the base rule alone. (test: "replaces an existing override in the matching media rule")
- WHEN no matching media rule exists THE SYSTEM SHALL add one to the last media block after the base rule, else append a new block. (test: "appends a new media block when none follows the base rule")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T036`.
The last line must be `GATE PASS T036`. On `GATE FAIL T036 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T036` prints `GATE PASS T036`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T036: Plan style edits at the right rule and breakpoint
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
