# T069: Measure text contrast inside a board

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T069 (build), phase 8 |
| Depends on | T024, T065 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R29 |

**Create:** `src/ui/canvas/contrast.ts`, `tests/ui/contrast.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T069`):

1. `npx vitest run tests/ui/contrast.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`collectContrast(doc)` warns about every visible text element whose computed color is below WCAG contrast on its computed background.

## Context

UI module, canvas area. Real browsers resolve variables and inheritance, so contrast is measured in the board iframe, not from CSS text. The UI may not import the engine, so this file has its own copy of the WCAG formula; the test proves both give the same numbers. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface CheckFinding {
  id: string; kind: CheckKind; severity: Severity; title: string; detail: string;
  file: string | null; line: number | null; path: ElementPath | null;
}
```

## Current state

`src/ui/canvas/dom-paths.ts` exports `pathOf`.

## Steps

1. Create `src/ui/canvas/contrast.ts` with exactly this content:

```ts
import type { CheckFinding } from "../../contracts/model.ts";
import { pathOf } from "./dom-paths.ts";

export interface Rgb { r: number; g: number; b: number; a: number }

/** Computed-style colors: "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "rgb(1 2 3 / 50%)", "#rrggbb", "transparent"; else null. */
export function parseRgb(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{6})$/.exec(v);
  if (hex) return { r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16), a: 1 };
  const m = /^rgba?\((.+)\)$/.exec(v);
  if (!m) return null;
  const [main, slash] = m[1].split("/");
  const p = main.trim().split(/[\s,]+/).filter(Boolean).map((x) => parseFloat(x));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  const alphaText = slash?.trim();
  const a = alphaText ? (alphaText.endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText)) : (p[3] ?? 1);
  return { r: p[0], g: p[1], b: p[2], a };
}

function luminance(c: Rgb): number {
  const lin = (x: number) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast of fg (composited onto bg) against bg, 2 decimals. Same formula as the engine's contrastRatio. */
export function ratioOf(fg: Rgb, bg: Rgb): number {
  const mixed = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
  const l1 = luminance(mixed);
  const l2 = luminance(bg);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}

/** First ancestor-or-self background with alpha > 0, composited onto white; white when none. */
export function backgroundOf(el: Element, win: Window): Rgb {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const bg = parseRgb(win.getComputedStyle(cur).backgroundColor);
    if (bg && bg.a > 0) return { r: bg.r * bg.a + 255 * (1 - bg.a), g: bg.g * bg.a + 255 * (1 - bg.a), b: bg.b * bg.a + 255 * (1 - bg.a), a: 1 };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/**
 * Low-contrast text in a board document: every visible element under body with its own non-empty text node.
 * Large text (>= 24px, or >= 18.66px with weight >= 700) needs 3:1, other text 4.5:1. One warning per element:
 * id `a11y:contrast:${path}`, title `Text contrast ${ratio}:1 is below ${min}:1`, detail `${color} on ${background}`.
 */
export function collectContrast(doc: Document): CheckFinding[] {
  const win = doc.defaultView;
  if (!win || !doc.body) return [];
  const out: CheckFinding[] = [];
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
    if (!ownText) continue;
    const cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const fg = parseRgb(cs.color);
    if (!fg) continue;
    const bg = backgroundOf(el, win);
    const ratio = ratioOf(fg, bg);
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const min = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    if (ratio >= min) continue;
    const path = pathOf(el);
    const rgb = (c: Rgb) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
    out.push({ id: `a11y:contrast:${path}`, kind: "a11y", severity: "warning", title: `Text contrast ${ratio}:1 is below ${min}:1`,
      detail: `${rgb(fg)} on ${rgb(bg)}`, file: null, line: null, path });
  }
  return out;
}
```

2. Create `tests/ui/contrast.test.ts` with exactly this content:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { collectContrast, parseRgb, ratioOf } from "../../src/ui/canvas/contrast.ts";
import { contrastRatio, parseCssColor } from "../../src/engine/checks/color.ts";

describe("contrast in boards", () => {
  it("parses computed colors", () => {
    expect(parseRgb("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseRgb("rgba(1, 2, 3, 0.25)")).toEqual({ r: 1, g: 2, b: 3, a: 0.25 });
    expect(parseRgb("rgb(1 2 3 / 50%)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseRgb("currentcolor")).toBeNull();
  });
  it("matches the engine's contrast formula", () => {
    for (const [fg, bg] of [["#777777", "#ffffff"], ["#b4532a", "#f3eee4"], ["#1e2a22", "#fbf8f2"]]) {
      expect(ratioOf(parseRgb(fg)!, parseRgb(bg)!)).toBe(contrastRatio(parseCssColor(fg)!, parseCssColor(bg)!));
    }
  });
  it("flags low-contrast text with its path and keeps large text at 3:1", () => {
    document.body.innerHTML = `
      <main style="background-color: rgb(255, 255, 255)">
        <p style="color: rgb(170, 170, 170)">Faint</p>
        <h1 style="color: rgb(140, 140, 140); font-size: 32px">Big enough</h1>
        <p style="color: rgb(0, 0, 0)">Fine</p>
        <p style="color: rgb(170, 170, 170); display: none">Hidden</p>
      </main>`;
    const found = collectContrast(document);
    expect(found.map((f) => [f.id, f.title, f.detail, f.path])).toEqual([
      ["a11y:contrast:0.0", "Text contrast 2.32:1 is below 4.5:1", "rgb(170, 170, 170) on rgb(255, 255, 255)", "0.0"],
    ]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL give the same ratios as the engine's contrastRatio. (test: "matches the engine's contrast formula")
- THE SYSTEM SHALL flag text below 4.5:1, or below 3:1 for large text, skipping hidden elements. (test: "flags low-contrast text with its path and keeps large text at 3:1")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T069`.
The last line must be `GATE PASS T069`. On `GATE FAIL T069 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/app, components, canvas, panels, styles` and uses only the contracts (fakes only in tests).
- Do not change any class name, test id, aria-label, role or visible text from the code given.
- Do not use italics, inline color literals or new CSS variables.
- Do not import from `src/engine/` or `src/server/`; the UI talks to the studio only through the store.

## Done when

- `verify.ps1 -Card T069` prints `GATE PASS T069`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T069: Measure text contrast inside a board
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
