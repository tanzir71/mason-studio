# T037: Plan resetting a breakpoint override

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T037 (build), phase 4 |
| Depends on | T036 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R20 |

**Create:** `src/engine/css/plan-reset.ts`, `tests/engine/plan-reset.test.ts`

**Modify:** none

**Read only:** `src/engine/css/plan-style.ts`, `src/engine/css/cascade.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T037`):

1. `npx vitest run tests/engine/plan-reset.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`planResetOverride` removes a property's tablet or mobile override so the wider value shows again, removing empty rules and media blocks.

## Context

Engine module, CSS area. The Design panel's Reset button (T043) uses it through `resetStyle`. Pure function: no I/O, no global state. Inputs are never mutated.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export interface PlanResetInput { sheets: CssSheet[]; el: ElementMatcher; prop: string; scope: Scope }
/**
 * planResetOverride(input): removes the element's `prop` override at "tablet"/"mobile" so the wider value shows.
 * "all" → []. For every applying cascade entry (at the scope width) whose rule.media === M (see above):
 * remove the declaration. A removal starts at the "\n" before the item when only spaces/tabs separate them
 * (else at the item start) and ends at the item end. When every declaration of a rule is removed, remove the
 * whole rule instead; when every rule inside a media block is removed, remove the whole block instead.
 * Edits never overlap; sorted by start ascending.
 */
export type PlanResetOverride = (input: PlanResetInput) => TextEdit[];
```

```ts
// src/contracts/model.ts
export interface SourceRange { start: number; end: number }
export interface TextEdit { file: string; start: number; end: number; text: string }
```

## Current state

`src/engine/css/plan-style.ts` exports `scopeMedia(scope)` returning `{ media, width, maxWidth }`; `src/engine/css/cascade.ts` exports `resolveCascade`.

## Steps

1. Create `src/engine/css/plan-reset.ts` with exactly this content:

```ts
import type { SourceRange, TextEdit } from "../../contracts/model.ts";
import type { PlanResetInput } from "../../contracts/engine.ts";
import { resolveCascade } from "./cascade.ts";
import { scopeMedia } from "./plan-style.ts";

/** Removal range of an item: from the "\n" before it when only spaces/tabs separate them, to its end. */
export function removalRange(text: string, item: SourceRange): SourceRange {
  let k = item.start;
  while (k > 0 && (text[k - 1] === " " || text[k - 1] === "\t")) k -= 1;
  return { start: k > 0 && text[k - 1] === "\n" ? k - 1 : item.start, end: item.end };
}

/** See PlanResetOverride in src/contracts/engine.ts. */
export function planResetOverride(input: PlanResetInput): TextEdit[] {
  const { sheets, el, prop, scope } = input;
  if (scope === "all") return [];
  const { media: M, width } = scopeMedia(scope);
  const entries = resolveCascade(sheets, el, prop, width).filter((e) => e.applies && e.rule.media === M);
  const edits: TextEdit[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    const mine = entries.filter((e) => e.sheetIndex === sheetIndex);
    if (mine.length === 0) return;
    const removedDecls = new Map<number, Set<number>>();
    for (const e of mine) {
      if (!removedDecls.has(e.rule.index)) removedDecls.set(e.rule.index, new Set());
      removedDecls.get(e.rule.index)!.add(e.declIndex);
    }
    const wholeRules = new Set<number>();
    for (const [ruleIndex, decls] of removedDecls) {
      if (decls.size === sheet.rules[ruleIndex].declarations.length) wholeRules.add(ruleIndex);
    }
    const coveredRules = new Set<number>();
    for (const block of sheet.mediaBlocks) {
      const inside = sheet.rules.filter((r) => r.range.start >= block.range.start && r.range.end <= block.range.end);
      if (inside.length > 0 && inside.every((r) => wholeRules.has(r.index))) {
        const r = removalRange(sheet.text, block.range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
        inside.forEach((x) => coveredRules.add(x.index));
      }
    }
    for (const [ruleIndex, decls] of removedDecls) {
      if (coveredRules.has(ruleIndex)) continue;
      const rule = sheet.rules[ruleIndex];
      if (wholeRules.has(ruleIndex)) {
        const r = removalRange(sheet.text, rule.range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
        continue;
      }
      for (const d of decls) {
        const r = removalRange(sheet.text, rule.declarations[d].range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
      }
    }
  });
  return edits.sort((a, b) => a.start - b.start);
}
```

2. Create `tests/engine/plan-reset.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planResetOverride, removalRange } from "../../src/engine/css/plan-reset.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanResetOverride } from "../../src/contracts/engine.ts";
import type { Scope } from "../../src/contracts/model.ts";

const _t: PlanResetOverride = planResetOverride;
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const fixture = readFileSync("tests/fixtures/northfield/styles.css", "utf8");
const run = (css: string, path: string, prop: string, scope: Scope) =>
  applyTextEdits(css, planResetOverride({ sheets: [parseStylesheet("styles.css", css)], el: page.matcher(path)!, prop, scope }));

describe("planResetOverride", () => {
  it("does nothing for all sizes", () => {
    expect(planResetOverride({ sheets: [parseStylesheet("styles.css", fixture)], el: page.matcher("1.0.0.1")!, prop: "font-size", scope: "all" })).toEqual([]);
  });
  it("removes a rule whose only declaration is reset", () => {
    expect(run(fixture, "1.0.0.1", "font-size", "tablet")).toContain("    padding: 40px 32px;\n  }\n}\n\n@media (max-width: 375px)");
  });
  it("removes the whole media block when its last rule goes", () => {
    expect(run(fixture, "1.0.0.1", "font-size", "mobile").endsWith("    font-size: 32px;\n  }\n}\n\n")).toBe(true);
  });
  it("removes only the declaration when the rule keeps others", () => {
    const css = "@media (max-width: 768px) {\n  .hero h1 {\n    font-size: 32px;\n    margin: 0;\n  }\n}\n";
    expect(run(css, "1.0.0.1", "font-size", "tablet")).toBe("@media (max-width: 768px) {\n  .hero h1 {\n    margin: 0;\n  }\n}\n");
  });
  it("starts a removal at the newline before indentation", () => {
    expect(removalRange("a\n   b;", { start: 5, end: 7 })).toEqual({ start: 1, end: 7 });
    expect(removalRange("a { b; }", { start: 4, end: 6 })).toEqual({ start: 4, end: 6 });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL return no edits for scope all. (test: "does nothing for all sizes")
- WHEN every declaration of a rule is removed THE SYSTEM SHALL remove the rule, and the media block when it becomes empty. (test: "removes the whole media block when its last rule goes")
- WHEN the rule keeps other declarations THE SYSTEM SHALL remove only the reset declaration and its line. (test: "removes only the declaration when the rule keeps others")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T037`.
The last line must be `GATE PASS T037`. On `GATE FAIL T037 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T037` prints `GATE PASS T037`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T037: Plan resetting a breakpoint override
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
