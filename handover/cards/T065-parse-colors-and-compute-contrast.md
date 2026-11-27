# T065: Parse colors and compute contrast

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T065 (build), phase 8 |
| Depends on | C1 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R29 |

**Create:** `src/engine/checks/color.ts`, `tests/engine/color.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T065`):

1. `npx vitest run tests/engine/color.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parseCssColor` reads hex, rgb()/rgba() and a few named colors; `contrastRatio` computes the WCAG 2 ratio.

## Context

Engine module, checks area. The browser contrast collector (T069) uses the same formula; its test compares both. Pure functions: no I/O.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export interface Rgba { r: number; g: number; b: number; a: number }
/** #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces (and "/ a"), white, black, transparent; else null. */
export type ParseCssColor = (value: string) => Rgba | null;
/** WCAG 2 contrast of fg over bg (fg alpha composited onto bg), rounded to 2 decimals. */
export type ContrastRatio = (fg: Rgba, bg: Rgba) => number;
```

## Current state

`src/engine/checks/` may contain `taste.ts`; this card does not use it.

## Steps

1. Create `src/engine/checks/color.ts` with exactly this content:

```ts
import type { Rgba } from "../../contracts/engine.ts";

const NAMED: Record<string, Rgba> = { white: { r: 255, g: 255, b: 255, a: 1 }, black: { r: 0, g: 0, b: 0, a: 1 }, transparent: { r: 0, g: 0, b: 0, a: 0 } };

function channel(v: string): number {
  return v.endsWith("%") ? Math.round(parseFloat(v) * 2.55) : Math.round(parseFloat(v));
}
function alphaOf(v: string | undefined): number {
  if (v === undefined) return 1;
  return v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
}

/** See ParseCssColor in src/contracts/engine.ts. */
export function parseCssColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  if (v in NAMED) return { ...NAMED[v] };
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }
  const fn = /^rgba?\((.+)\)$/.exec(v);
  if (fn) {
    const [main, slashAlpha] = fn[1].split("/");
    const parts = main.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const color = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alphaOf(slashAlpha?.trim() ?? parts[3]) };
    return [color.r, color.g, color.b, color.a].some(Number.isNaN) ? null : color;
  }
  return null;
}

function luminance(c: { r: number; g: number; b: number }): number {
  const lin = (x: number) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** See ContrastRatio in src/contracts/engine.ts. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const a = fg.a;
  const mixed = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
  const l1 = luminance(mixed);
  const l2 = luminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}
```

2. Create `tests/engine/color.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio, parseCssColor } from "../../src/engine/checks/color.ts";
import type { ContrastRatio, ParseCssColor } from "../../src/contracts/engine.ts";

const _t: [ParseCssColor, ContrastRatio] = [parseCssColor, contrastRatio];
void _t;

describe("colors", () => {
  it("parses hex, rgb and named colors", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor("#1E2A22")).toEqual({ r: 30, g: 42, b: 34, a: 1 });
    expect(parseCssColor("#00000080")).toEqual({ r: 0, g: 0, b: 0, a: 0.502 });
    expect(parseCssColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseCssColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseCssColor("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseCssColor("Transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColor("var(--x)")).toBeNull();
    expect(parseCssColor("#12345")).toBeNull();
  });
  it("computes WCAG contrast ratios", () => {
    const white = parseCssColor("white")!;
    expect(contrastRatio(parseCssColor("black")!, white)).toBe(21);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(parseCssColor("#777777")!, white)).toBe(4.48);
    expect(contrastRatio(parseCssColor("rgba(0, 0, 0, 0.5)")!, white)).toBe(3.98);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL parse #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), space syntax with / alpha, white, black and transparent; anything else is null. (test: "parses hex, rgb and named colors")
- THE SYSTEM SHALL compute WCAG contrast rounded to 2 decimals, compositing a translucent foreground. (test: "computes WCAG contrast ratios")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T065`.
The last line must be `GATE PASS T065`. On `GATE FAIL T065 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T065` prints `GATE PASS T065`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T065: Parse colors and compute contrast
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
