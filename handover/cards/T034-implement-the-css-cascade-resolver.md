# T034: Implement the CSS cascade resolver

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T034 (build), phase 4 |
| Depends on | T033, T008 |
| Effort | max |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R18 |

**Create:** `src/engine/css/cascade.ts`, `tests/engine/cascade.test.ts`

**Modify:** none

**Read only:** `src/engine/css/media.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T034`):

1. `npx vitest run tests/engine/cascade.test.ts` -> exit 0, output contains `Tests  6 passed (6)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`matchingRules` and `resolveCascade` find every rule that matches an element and the winning declaration for a property at a width.

## Context

Engine module, CSS area. This is the heart of "edits land where the value comes from": inspect (T039), style writes (T036/T040) and proposals all trust it. The sort orders below are exact. Pure function: no I/O, no global state. Inputs are never mutated.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * matchingRules(sheets, el, width): every rule with at least one selector in its list for which
 * el.matches(selector) is true (exceptions count as false). `selector` = the matching selector with the
 * highest specificity (first one on ties); `sheetIndex` = index in `sheets`; applies = mediaApplies(rule.media, width).
 * Sorted highest priority first: applies (true first), specificity (desc, compare a then b then c),
 * sheetIndex (desc), rule.index (desc).
 */
export type MatchingRules = (sheets: CssSheet[], el: ElementMatcher, width: number) => RuleMatch[];
/**
 * resolveCascade(sheets, el, prop, width): one entry per declaration with declaration.prop === prop in every
 * matching rule. Sorted: applies (true first), important (true first), specificity (desc), sheetIndex (desc),
 * rule.index (desc), declIndex (desc). winning = true only for the first entry, and only if it applies.
 */
export type ResolveCascade = (sheets: CssSheet[], el: ElementMatcher, prop: string, width: number) => CascadeEntry[];
```

```ts
// src/contracts/model.ts
export interface ElementMatcher { matches(selector: string): boolean }
export interface RuleMatch { rule: CssRule; selector: string; specificity: Specificity; sheetIndex: number; applies: boolean }
export interface CascadeEntry extends RuleMatch { declaration: CssDeclaration; declIndex: number; winning: boolean }
export interface CssRule {
  file: string;
  index: number;         // order of appearance among the sheet's collected rules (0-based)
  selector: string;      // selector list as written, trimmed
  media: string | null;  // normalized params of the enclosing @media (lowercase, single spaces), null at top level
  line: number;          // 1-based line of the selector
  declarations: CssDeclaration[];
  range: SourceRange;    // selector start to closing "}" inclusive
export interface CssDeclaration {
  prop: string;          // lowercase
  value: string;         // as written, trimmed, without "!important"
  important: boolean;
  range: SourceRange;    // whole declaration, including the trailing ";" when present
  valueRange: SourceRange; // only the value text (excludes "!important")
}
```

## Current state

`src/engine/css/media.ts` (T033) exports `mediaApplies`, `specificityOf`, `compareSpecificity(x, y)` (positive when x is stronger) and `splitSelectorList`. `src/engine/html/parse.ts` gives `ElementMatcher`s through `PageModel.matcher(path)`.

## Steps

1. Create `src/engine/css/cascade.ts` with exactly this content:

```ts
import type { CascadeEntry, CssSheet, ElementMatcher, RuleMatch } from "../../contracts/model.ts";
import { compareSpecificity, mediaApplies, specificityOf, splitSelectorList } from "./media.ts";

/** See MatchingRules in src/contracts/engine.ts. */
export function matchingRules(sheets: CssSheet[], el: ElementMatcher, width: number): RuleMatch[] {
  const out: RuleMatch[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    for (const rule of sheet.rules) {
      let best: { selector: string; spec: [number, number, number] } | null = null;
      for (const selector of splitSelectorList(rule.selector)) {
        let ok = false;
        try { ok = el.matches(selector); } catch { ok = false; }
        if (!ok) continue;
        const spec = specificityOf(selector);
        if (!best || compareSpecificity(spec, best.spec) > 0) best = { selector, spec };
      }
      if (best) out.push({ rule, selector: best.selector, specificity: best.spec, sheetIndex, applies: mediaApplies(rule.media, width) });
    }
  });
  return out.sort((x, y) =>
    (Number(y.applies) - Number(x.applies)) || compareSpecificity(y.specificity, x.specificity) ||
    (y.sheetIndex - x.sheetIndex) || (y.rule.index - x.rule.index));
}

/** See ResolveCascade in src/contracts/engine.ts. */
export function resolveCascade(sheets: CssSheet[], el: ElementMatcher, prop: string, width: number): CascadeEntry[] {
  const entries: CascadeEntry[] = [];
  for (const m of matchingRules(sheets, el, width)) {
    m.rule.declarations.forEach((declaration, declIndex) => {
      if (declaration.prop === prop) entries.push({ ...m, declaration, declIndex, winning: false });
    });
  }
  entries.sort((x, y) =>
    (Number(y.applies) - Number(x.applies)) || (Number(y.declaration.important) - Number(x.declaration.important)) ||
    compareSpecificity(y.specificity, x.specificity) || (y.sheetIndex - x.sheetIndex) ||
    (y.rule.index - x.rule.index) || (y.declIndex - x.declIndex));
  if (entries[0]?.applies) entries[0].winning = true;
  return entries;
}
```

2. Create `tests/engine/cascade.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchingRules, resolveCascade } from "../../src/engine/css/cascade.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { MatchingRules, ResolveCascade } from "../../src/contracts/engine.ts";

const _t: [MatchingRules, ResolveCascade] = [matchingRules, resolveCascade];
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const styles = parseStylesheet("styles.css", readFileSync("tests/fixtures/northfield/styles.css", "utf8"));
const h1 = page.matcher("1.0.0.1")!;

describe("matchingRules", () => {
  it("orders applying rules by specificity, then source order", () => {
    const rows = matchingRules([styles], h1, 768).map((m) => [m.rule.selector, m.rule.media, m.applies]);
    expect(rows).toEqual([[".hero h1", "(max-width: 768px)", true], [".hero h1", null, true], [".hero h1", "(max-width: 375px)", false]]);
  });
  it("picks the most specific matching selector of a list", () => {
    const sheet = parseStylesheet("a.css", "h1, .hero .headline, p { color: red; }\n");
    const [m] = matchingRules([sheet], h1, 1280);
    expect([m.selector, m.specificity]).toEqual([".hero .headline", [0, 2, 0]]);
  });
  it("ranks later sheets above earlier ones at equal specificity", () => {
    const a = parseStylesheet("a.css", ".headline { color: red; }\n");
    const b = parseStylesheet("b.css", ".headline { color: blue; }\n");
    expect(matchingRules([a, b], h1, 1280).map((m) => m.rule.file)).toEqual(["b.css", "a.css"]);
  });
});

describe("resolveCascade", () => {
  it("finds the winning font-size at each breakpoint", () => {
    const win = (w: number) => resolveCascade([styles], h1, "font-size", w).find((e) => e.winning)?.declaration.value;
    expect([win(1280), win(768), win(375)]).toEqual(["40px", "32px", "28px"]);
  });
  it("lets !important beat specificity and marks non-applying entries", () => {
    const sheet = parseStylesheet("a.css", "h1 { color: red !important; }\n.hero h1 { color: blue; }\n@media (max-width: 100px) { h1 { color: green; } }\n");
    const entries = resolveCascade([sheet], h1, "color", 1280);
    expect(entries.map((e) => [e.declaration.value, e.winning, e.applies])).toEqual([["red", true, true], ["blue", false, true], ["green", false, false]]);
  });
  it("prefers the later declaration inside one rule and has no winner when nothing applies", () => {
    const sheet = parseStylesheet("a.css", ".headline { color: red; color: blue; }\n@media print { .headline { margin: 0; } }\n");
    expect(resolveCascade([sheet], h1, "color", 1280)[0].declaration.value).toBe("blue");
    expect(resolveCascade([sheet], h1, "margin", 1280).map((e) => e.winning)).toEqual([false]);
    expect(resolveCascade([sheet], h1, "padding", 1280)).toEqual([]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL order matching rules: applying first, then specificity, sheet index, rule index, all descending. (test: "orders applying rules by specificity, then source order")
- THE SYSTEM SHALL resolve the fixture headline font-size to 40px, 32px and 28px at 1280, 768 and 375. (test: "finds the winning font-size at each breakpoint")
- THE SYSTEM SHALL let !important beat specificity and mark only an applying first entry as winning. (test: "lets !important beat specificity and marks non-applying entries")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T034`.
The last line must be `GATE PASS T034`. On `GATE FAIL T034 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T034` prints `GATE PASS T034`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T034: Implement the CSS cascade resolver
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
