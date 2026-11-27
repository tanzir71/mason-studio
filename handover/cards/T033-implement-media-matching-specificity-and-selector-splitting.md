# T033: Implement media matching, specificity and selector splitting

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T033 (build), phase 4 |
| Depends on | T006 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R18 |

**Create:** `src/types/bramus-specificity.d.ts`, `src/engine/css/media.ts`, `tests/engine/media.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T033`):

1. `npx vitest run tests/engine/media.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`mediaApplies`, `specificityOf`, `compareSpecificity` and `splitSelectorList` tell which rules apply at a width and how strong their selectors are.

## Context

Engine module, CSS area. The cascade (T034) is built on these. @bramus/specificity 2.4.5 is installed, but its package.json `exports` hides its own types from TypeScript under `nodenext`, so this card adds a small ambient declaration file. Pure function: no I/O, no global state. Inputs are never mutated.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * mediaApplies(media, width): null → true. Comma list → true if any part applies.
 * A part is terms joined by " and ": "all", "screen", "only screen" → true; "print" → false;
 * "(max-width: Npx)" → width <= N; "(min-width: Npx)" → width >= N; em/rem count as 16px.
 * Any other term (including "not ...") → false.
 */
export type MediaApplies = (media: string | null, width: number) => boolean;
/** Specificity of ONE complex selector (no commas) via @bramus/specificity: [a, b, c]. */
export type SpecificityOf = (selector: string) => Specificity;
/** Split a selector list on top-level commas (not inside (), [] or quotes); trim parts; drop empty parts. */
export type SplitSelectorList = (list: string) => string[];
```

```ts
// src/contracts/model.ts
/** [ids, classes/attributes/pseudo-classes, types/pseudo-elements] */
export type Specificity = [number, number, number];
```

## Current state

`src/engine/css/parse.ts` exists (T006). `src/types/` does not exist. The planner verified: `Specificity.calculate(".hero h1")[0].value` is `{ a: 0, b: 1, c: 1 }`, and `calculate("((")` throws.

## Steps

1. Create `src/types/bramus-specificity.d.ts` with exactly this content:

```ts
/** Types for @bramus/specificity 2.4.5: its package.json "exports" hides its own index.d.ts from TypeScript (nodenext). */
declare module "@bramus/specificity" {
  export interface SpecificityValue { a: number; b: number; c: number }
  export default class Specificity {
    static calculate(selector: string): { value: SpecificityValue }[];
  }
}
```

2. Create `src/engine/css/media.ts` with exactly this content:

```ts
import Specificity from "@bramus/specificity";
import type { Specificity as Spec } from "../../contracts/model.ts";

function termApplies(term: string, width: number): boolean {
  if (term === "all" || term === "screen" || term === "only screen") return true;
  const m = /^\(\s*(max|min)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)$/.exec(term);
  if (!m) return false;
  const px = Number(m[2]) * (m[3] === "px" ? 1 : 16);
  return m[1] === "max" ? width <= px : width >= px;
}

/** See MediaApplies in src/contracts/engine.ts. */
export function mediaApplies(media: string | null, width: number): boolean {
  if (media === null) return true;
  return media.split(",").some((part) => {
    const terms = part.trim().toLowerCase().split(/\s+and\s+/);
    return terms.every((t) => termApplies(t.trim(), width));
  });
}

/** [a, b, c] of one complex selector; [0, 0, 0] when it cannot be parsed. */
export function specificityOf(selector: string): Spec {
  try {
    const v = Specificity.calculate(selector)[0].value;
    return [v.a, v.b, v.c];
  } catch {
    return [0, 0, 0];
  }
}

/** Positive when x is more specific than y, negative when less, 0 when equal. */
export function compareSpecificity(x: Spec, y: Spec): number {
  return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);
}

/** Split on commas outside (), [] and quotes; trim; drop empty parts. */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const ch of list) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "\"" || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
```

3. Create `tests/engine/media.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { compareSpecificity, mediaApplies, specificityOf, splitSelectorList } from "../../src/engine/css/media.ts";
import type { MediaApplies, SpecificityOf, SplitSelectorList } from "../../src/contracts/engine.ts";

const _t: [MediaApplies, SpecificityOf, SplitSelectorList] = [mediaApplies, specificityOf, splitSelectorList];
void _t;

describe("mediaApplies", () => {
  it("applies without media and for screen/all", () => {
    expect(mediaApplies(null, 375)).toBe(true);
    expect(mediaApplies("screen", 1280)).toBe(true);
    expect(mediaApplies("only screen and (max-width: 768px)", 768)).toBe(true);
    expect(mediaApplies("print", 1280)).toBe(false);
  });
  it("compares max-width and min-width, counting em as 16px", () => {
    expect(mediaApplies("(max-width: 768px)", 768)).toBe(true);
    expect(mediaApplies("(max-width: 768px)", 1280)).toBe(false);
    expect(mediaApplies("(min-width: 48em)", 768)).toBe(true);
    expect(mediaApplies("(min-width: 48em)", 375)).toBe(false);
  });
  it("treats comma lists as or and unknown terms as false", () => {
    expect(mediaApplies("print, (max-width: 400px)", 375)).toBe(true);
    expect(mediaApplies("(prefers-color-scheme: dark)", 1280)).toBe(false);
    expect(mediaApplies("not screen", 1280)).toBe(false);
  });
});

describe("selectors", () => {
  it("computes specificity of one selector", () => {
    expect(specificityOf(".hero h1")).toEqual([0, 1, 1]);
    expect(specificityOf("#menu .card:hover")).toEqual([1, 2, 0]);
    expect(specificityOf("((")).toEqual([0, 0, 0]);
    expect(compareSpecificity([0, 2, 0], [0, 1, 9])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
  });
  it("splits selector lists on top-level commas only", () => {
    expect(splitSelectorList(" h1, .a:is(.b, .c) , [data-x='a,b'],, p ")).toEqual(["h1", ".a:is(.b, .c)", "[data-x='a,b']", "p"]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL evaluate max-width and min-width terms in px, em and rem at a width. (test: "compares max-width and min-width, counting em as 16px")
- THE SYSTEM SHALL treat comma lists as OR and unknown terms as not applying. (test: "treats comma lists as or and unknown terms as false")
- THE SYSTEM SHALL split selector lists only on top-level commas. (test: "splits selector lists on top-level commas only")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T033`.
The last line must be `GATE PASS T033`. On `GATE FAIL T033 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T033` prints `GATE PASS T033`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T033: Implement media matching, specificity and selector splitting
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
