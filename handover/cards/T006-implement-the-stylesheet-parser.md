# T006: Implement the stylesheet parser

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T006 (build), phase 2 |
| Depends on | C1 |
| Effort | max |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R4 |

**Create:** `src/engine/css/parse.ts`, `tests/engine/parse-css.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T006`):

1. `npx vitest run tests/engine/parse-css.test.ts` -> exit 0, output contains `Tests  6 passed (6)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parseStylesheet(file, text)` turns CSS text into the CssSheet model with exact source ranges.

## Context

Engine module, CSS area. Everything that edits CSS (cascade, write-back, reset, checks) reads these ranges, so offsets must be exact. Pure function, no I/O.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * parseStylesheet(file, text) — postcss.parse(text, { from: file }).
 * Collects Rule nodes directly under the root and Rule nodes directly inside a root-level `@media`
 * (name compared case-insensitively). Ignores everything else (other at-rules, nested rules, comments).
 * - rule.media = normalizeMedia(atRule.params) or null; rule.index counts collected rules in source order.
 * - rule.range = [rule.source.start.offset, rule.source.end.offset); bodyRange = [offset after "{", offset of "}").
 * - decl.range = [decl.source.start.offset, decl.source.end.offset) (includes ";" when present);
 *   valueRange.start = range.start + decl.prop.length + decl.raws.between.length;
 *   valueRange.end = valueRange.start + (decl.raws.value?.raw ?? decl.value).length.
 * - mediaBlocks: one per root-level @media: { media, range, bodyEnd = source.end.offset - 1 }.
 * Throws MasonError("CSS_PARSE_ERROR", `${file}:${line}`) when postcss throws CssSyntaxError.
 */
export type ParseStylesheet = (file: string, text: string) => CssSheet;
/** "( MAX-WIDTH:768px )" → "(max-width: 768px)": lowercase, collapse whitespace, trim, no space after "(" or before ")", exactly one space after ":". */
export type NormalizeMedia = (params: string) => string;
```

```ts
// src/contracts/model.ts
export interface SourceRange { start: number; end: number }
export interface CssDeclaration {
  prop: string;          // lowercase
  value: string;         // as written, trimmed, without "!important"
  important: boolean;
  range: SourceRange;    // whole declaration, including the trailing ";" when present
  valueRange: SourceRange; // only the value text (excludes "!important")
}
export interface CssRule {
  file: string;
  index: number;         // order of appearance among the sheet's collected rules (0-based)
  selector: string;      // selector list as written, trimmed
  media: string | null;  // normalized params of the enclosing @media (lowercase, single spaces), null at top level
  line: number;          // 1-based line of the selector
  declarations: CssDeclaration[];
  range: SourceRange;    // selector start to closing "}" inclusive
export interface CssMediaBlock { file: string; media: string; range: SourceRange; bodyEnd: number /* offset of its closing "}" */ }
export interface CssSheet { file: string; text: string; rules: CssRule[]; mediaBlocks: CssMediaBlock[] }
export interface ElementMatcher { matches(selector: string): boolean }
/** [ids, classes/attributes/pseudo-classes, types/pseudo-elements] */
export type Specificity = [number, number, number];
export interface RuleRef { file: string; line: number; selector: string; media: string | null }
export interface RuleMatch { rule: CssRule; selector: string; specificity: Specificity; sheetIndex: number; applies: boolean }
export interface CascadeEntry extends RuleMatch { declaration: CssDeclaration; declIndex: number; winning: boolean }
export interface TextEdit { file: string; start: number; end: number; text: string }

// ---------- Inspect and writes ----------
export const INSPECT_PROPS = [
export interface CssSheet { file: string; text: string; rules: CssRule[]; mediaBlocks: CssMediaBlock[] }
```

## Current state

`src/engine/css/` does not exist. postcss 8.5.33 is installed. The planner verified: `decl.source.end.offset` is exclusive and includes the `;`; `rule.source.end.offset` is exclusive and includes the `}`.

## Steps

1. Create `src/engine/css/parse.ts` exporting `normalizeMedia(params: string): string` and `parseStylesheet(file: string, text: string): CssSheet`:
```ts
import postcss from "postcss";
import type { AtRule, Declaration, Rule } from "postcss";
import { MasonError } from "../../contracts/errors.ts";
import type { CssDeclaration, CssMediaBlock, CssRule, CssSheet } from "../../contracts/model.ts";

export function normalizeMedia(params: string): string {
  return params.toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s*:\s*/g, ": ");
}

export function parseStylesheet(file: string, text: string): CssSheet {
  let root;
  try {
    root = postcss.parse(text, { from: file });
  } catch (error) {
    // TODO: when (error as { name?: string }).name === "CssSyntaxError" throw
    //       new MasonError("CSS_PARSE_ERROR", `${file}:${(error as { line?: number }).line ?? 1}`); else rethrow.
  }
  const rules: CssRule[] = [];
  const mediaBlocks: CssMediaBlock[] = [];
  const addRule = (rule: Rule, media: string | null) => {
    // TODO: build the CssRule exactly as the contract says:
    //  range = { start: rule.source!.start!.offset, end: rule.source!.end!.offset }
    //  bodyRange = { start: text.indexOf("{", range.start) + 1, end: range.end - 1 }
    //  declarations = rule.nodes filtered to type "decl", mapped with toDeclaration(decl)
    //  index = rules.length, line = rule.source!.start!.line, selector = rule.selector.trim()
  };
  for (const node of root.nodes) {
    if (node.type === "rule") addRule(node, null);
    else if (node.type === "atrule" && node.name.toLowerCase() === "media") {
      // TODO: media = normalizeMedia(node.params); push { file, media, range, bodyEnd: end offset - 1 } to mediaBlocks;
      //       call addRule for every direct child of type "rule".
    }
  }
  return { file, text, rules, mediaBlocks };
}

function toDeclaration(decl: Declaration): CssDeclaration {
  // TODO: prop lowercased, value = decl.value, important = decl.important === true,
  //  range = [decl.source!.start!.offset, decl.source!.end!.offset),
  //  valueRange.start = range.start + decl.prop.length + (decl.raws.between ?? "").length,
  //  valueRange.end = valueRange.start + (decl.raws.value?.raw ?? decl.value).length.
}
void (null as unknown as AtRule);
```

2. Create `tests/engine/parse-css.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeMedia, parseStylesheet } from "../../src/engine/css/parse.ts";
import type { NormalizeMedia, ParseStylesheet } from "../../src/contracts/engine.ts";

const _types: [ParseStylesheet, NormalizeMedia] = [parseStylesheet, normalizeMedia];
void _types;
const HERO = ".hero h1 {\n  font-size: 40px;\n  color: red !important;\n}\n";

describe("parseStylesheet", () => {
  it("collects top-level and @media rules in order and ignores other at-rules", () => {
    const css = ".a { color: red; }\n@media (max-width:768px) {\n  .a { color: blue; }\n}\n@supports (display: grid) { .b { color: green; } }\n";
    const sheet = parseStylesheet("x.css", css);
    expect(sheet.rules.map((r) => [r.selector, r.media, r.index])).toEqual([[".a", null, 0], [".a", "(max-width: 768px)", 1]]);
    expect(sheet.mediaBlocks.map((b) => b.media)).toEqual(["(max-width: 768px)"]);
    expect(css[sheet.mediaBlocks[0].bodyEnd]).toBe("}");
  });
  it("records declaration and value ranges", () => {
    const sheet = parseStylesheet("x.css", HERO);
    const [size, color] = sheet.rules[0].declarations;
    expect(size).toMatchObject({ prop: "font-size", value: "40px", important: false, range: { start: 13, end: 29 }, valueRange: { start: 24, end: 28 } });
    expect(HERO.slice(size.range.start, size.range.end)).toBe("font-size: 40px;");
    expect(color).toMatchObject({ prop: "color", value: "red", important: true });
    expect(HERO.slice(color.valueRange.start, color.valueRange.end)).toBe("red");
  });
  it("records the rule range, body range and line", () => {
    const rule = parseStylesheet("x.css", "\n" + HERO).rules[0];
    expect(rule.line).toBe(2);
    expect(rule.range).toEqual({ start: 1, end: 57 });
    expect(rule.bodyRange).toEqual({ start: 11, end: 56 });
    expect(rule.file).toBe("x.css");
  });
  it("throws CSS_PARSE_ERROR with file and line", () => {
    expect(() => parseStylesheet("x.css", "a { color: red;\n")).toThrow("The stylesheet could not be parsed. x.css:1");
  });
  it("parses the fixture stylesheet", () => {
    const text = readFileSync("tests/fixtures/northfield/styles.css", "utf8");
    const sheet = parseStylesheet("styles.css", text);
    expect(sheet.rules.length).toBe(14);
    expect(sheet.mediaBlocks.map((b) => b.media)).toEqual(["(max-width: 768px)", "(max-width: 375px)"]);
    const tablet = sheet.rules[12];
    expect([tablet.selector, tablet.media]).toEqual([".hero h1", "(max-width: 768px)"]);
    const d = tablet.declarations[0];
    expect(text.slice(d.valueRange.start, d.valueRange.end)).toBe("32px");
  });
});

describe("normalizeMedia", () => {
  it("lowercases and normalizes spaces", () => {
    expect(normalizeMedia("( MAX-WIDTH:768px )")).toBe("(max-width: 768px)");
    expect(normalizeMedia("screen   and (min-width:1024px)")).toBe("screen and (min-width: 1024px)");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN CSS has top-level, @media and other at-rules THE SYSTEM SHALL collect only top-level and @media rules, in order. (test: "collects top-level and @media rules in order and ignores other at-rules")
- THE SYSTEM SHALL record exact declaration and value ranges. (test: "records declaration and value ranges")
- THE SYSTEM SHALL record the rule range, body range and 1-based line. (test: "records the rule range, body range and line")
- IF postcss throws a syntax error THEN THE SYSTEM SHALL throw CSS_PARSE_ERROR with `file:line`. (test: "throws CSS_PARSE_ERROR with file and line")
- THE SYSTEM SHALL normalize media params. (test: "lowercases and normalizes spaces")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T006`.
The last line must be `GATE PASS T006`. On `GATE FAIL T006 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).
- Do not re-serialize CSS with postcss; edits always use the original text and offsets.

## Done when

- `verify.ps1 -Card T006` prints `GATE PASS T006`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T006: Implement the stylesheet parser
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
