# T035: Implement text edits and rule appends

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T035 (build), phase 4 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19 |

**Create:** `src/engine/css/edits.ts`, `tests/engine/edits.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T035`):

1. `npx vitest run tests/engine/edits.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`applyTextEdits`, `appendEdit` and `planAppendRule` apply non-overlapping text edits and append rules safely.

## Context

Engine module, CSS area. Every write in Mason is a list of TextEdits against the original file text, so formatting and comments outside the edited ranges never change. Pure function: no I/O, no global state. Inputs are never mutated.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * applyTextEdits(text, edits) → new text. Edits refer to the same file (`file` is ignored).
 * Throws MasonError("EDIT_CONFLICT") when two edits overlap (a.start < b.end && b.start < a.end) or share a start.
 * Applies from the highest start to the lowest. Out-of-range offsets → INVALID_INPUT.
 */
export type ApplyTextEdits = (text: string, edits: TextEdit[]) => string;
/** One edit appending `${selector} {\n  ${prop}: ${value};\n ...}\n` at the end of `text` ("\n" prefix as in Append). */
export type PlanAppendRule = (file: string, text: string, selector: string, declarations: [string, string][]) => TextEdit;
```

```ts
// src/contracts/model.ts
export interface TextEdit { file: string; start: number; end: number; text: string }
```

## Current state

`src/engine/css/` has `parse.ts` and (after T033) `media.ts`; this card does not use them.

## Steps

1. Create `src/engine/css/edits.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { TextEdit } from "../../contracts/model.ts";

/** See ApplyTextEdits in src/contracts/engine.ts. */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  for (const e of edits) {
    if (e.start < 0 || e.end < e.start || e.end > text.length) throw new MasonError("INVALID_INPUT", `edit ${e.start}-${e.end}`);
  }
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a.start === b.start || (a.start < b.end && b.start < a.end)) throw new MasonError("EDIT_CONFLICT", `${a.start}-${a.end} and ${b.start}-${b.end}`);
  }
  let out = text;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/** One edit at the end of `text`; prefixes "\n" when text does not end with "\n". */
export function appendEdit(file: string, text: string, addition: string): TextEdit {
  return { file, start: text.length, end: text.length, text: (text.endsWith("\n") ? "" : "\n") + addition };
}

/** See PlanAppendRule in src/contracts/engine.ts. */
export function planAppendRule(file: string, text: string, selector: string, declarations: [string, string][]): TextEdit {
  const body = declarations.map(([p, v]) => `  ${p}: ${v};\n`).join("");
  return appendEdit(file, text, `${selector} {\n${body}}\n`);
}
```

2. Create `tests/engine/edits.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { applyTextEdits, planAppendRule } from "../../src/engine/css/edits.ts";
import type { ApplyTextEdits, PlanAppendRule } from "../../src/contracts/engine.ts";

const _t: [ApplyTextEdits, PlanAppendRule] = [applyTextEdits, planAppendRule];
void _t;
const e = (start: number, end: number, text: string) => ({ file: "a.css", start, end, text });

describe("applyTextEdits", () => {
  it("applies edits in any order", () => {
    expect(applyTextEdits("abcdef", [e(4, 6, "XY"), e(0, 1, ""), e(2, 2, "-")])).toBe("b-cdXY");
  });
  it("rejects overlapping edits and edits sharing a start", () => {
    expect(() => applyTextEdits("abcdef", [e(0, 3, "x"), e(2, 4, "y")])).toThrow("Two edits overlap.");
    expect(() => applyTextEdits("abcdef", [e(1, 1, "x"), e(1, 1, "y")])).toThrow("Two edits overlap.");
    expect(applyTextEdits("abcdef", [e(0, 2, "x"), e(2, 3, "y")])).toBe("xydef");
  });
  it("rejects out-of-range offsets", () => {
    expect(() => applyTextEdits("abc", [e(2, 9, "")])).toThrow("Invalid input.");
  });
});

describe("planAppendRule", () => {
  it("appends a rule, adding a newline when the file does not end with one", () => {
    expect(planAppendRule("a.css", "a{}\n", ".frame-1", [["width", "160px"], ["height", "120px"]])).toEqual(e(4, 4, ".frame-1 {\n  width: 160px;\n  height: 120px;\n}\n"));
    expect(planAppendRule("a.css", "a{}", ".x", [["gap", "16px"]]).text).toBe("\n.x {\n  gap: 16px;\n}\n");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL apply edits from the highest start to the lowest. (test: "applies edits in any order")
- IF two edits overlap or share a start THEN THE SYSTEM SHALL throw EDIT_CONFLICT. (test: "rejects overlapping edits and edits sharing a start")
- WHEN a rule is appended to text without a final newline THE SYSTEM SHALL prefix one. (test: "appends a rule, adding a newline when the file does not end with one")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T035`.
The last line must be `GATE PASS T035`. On `GATE FAIL T035 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T035` prints `GATE PASS T035`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T035: Implement text edits and rule appends
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
