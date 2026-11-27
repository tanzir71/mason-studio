# T066: Check page structure and raw colors

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T066 (build), phase 8 |
| Depends on | T008, T006, T052 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R29 |

**Create:** `src/engine/checks/structure.ts`, `tests/engine/structure-checks.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T066`):

1. `npx vitest run tests/engine/structure-checks.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`checkPageStructure` finds extra H1s, heading jumps and images without alt; `checkRawColors` lists hex colors outside `:root` and suggests matching tokens.

## Context

Engine module, checks area. Pure functions: no I/O.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * checkPageStructure(body): warnings (kind "a11y"):
 *  - more than one h1: id "a11y:h1-count", title `Page has ${n} H1 headings`;
 *  - heading level jump (next > previous + 1, document order): id `a11y:heading:${path}`, title `Heading jumps from H${p} to H${n}`;
 *  - img without an alt attribute: id `a11y:alt:${path}`, title "Image has no alt text".
 * detail "", file/line null, path set (null for h1-count). passed: "Headings in order" when there are no heading
 * findings, "Images have alt text" when there are no alt findings.
 */
export type CheckPageStructure = (body: ElementNode) => { findings: CheckFinding[]; passed: string[] };
/**
 * checkRawColors(sheets, tokens): for each declaration in rules whose selector is not ":root" and whose value
 * contains a hex color (/#[0-9a-f]{3,8}\b/i): info finding id `tokens:${file}:${line}:${prop}`, kind "tokens",
 * title `Raw color ${hex} in ${selector}`, detail `Use ${token.name} instead.` when a color token has the same
 * lowercase 6-digit hex, else "Not a token.", file = rule.file, line = rule.line, path null.
 */
export type CheckRawColors = (sheets: CssSheet[], tokens: Token[]) => CheckFinding[];
```

```ts
// src/contracts/model.ts
export interface CheckFinding {
  id: string; kind: CheckKind; severity: Severity; title: string; detail: string;
  file: string | null; line: number | null; path: ElementPath | null;
}
export interface Token {
  name: string;                 // dot path, e.g. "color.ink"
  type: TokenType;
  value: string;                // CSS text: "#1e2a22", "16px", "Fraunces, serif", "600", "1.5"
  alias: string | null;         // "color.ink" when $value was "{color.ink}", else null
  byBreakpoint: Partial<Record<BreakpointId, string>>; // from $extensions["dev.mason.breakpoints"]
}
```

## Current state

Element nodes carry `tag`, `attrs` (with `alt` when present) and `children`; CSS rules carry `selector`, `line`, `file` and `declarations`.

## Steps

1. Create `src/engine/checks/structure.ts` with exactly this content:

```ts
import type { CheckFinding, CssSheet, ElementNode, Token } from "../../contracts/model.ts";

const finding = (id: string, title: string, path: string | null): CheckFinding =>
  ({ id, kind: "a11y", severity: "warning", title, detail: "", file: null, line: null, path });

/** See CheckPageStructure in src/contracts/engine.ts. */
export function checkPageStructure(body: ElementNode): { findings: CheckFinding[]; passed: string[] } {
  const headings: ElementNode[] = [];
  const findings: CheckFinding[] = [];
  let altMissing = 0;
  const walk = (n: ElementNode) => {
    if (/^h[1-6]$/.test(n.tag)) headings.push(n);
    if (n.tag === "img" && n.attrs.alt === undefined) { findings.push(finding(`a11y:alt:${n.path}`, "Image has no alt text", n.path)); altMissing += 1; }
    n.children.forEach(walk);
  };
  walk(body);
  const headingFindings: CheckFinding[] = [];
  const h1s = headings.filter((h) => h.tag === "h1").length;
  if (h1s > 1) headingFindings.push(finding("a11y:h1-count", `Page has ${h1s} H1 headings`, null));
  for (let i = 1; i < headings.length; i++) {
    const prev = Number(headings[i - 1].tag[1]);
    const next = Number(headings[i].tag[1]);
    if (next > prev + 1) headingFindings.push(finding(`a11y:heading:${headings[i].path}`, `Heading jumps from H${prev} to H${next}`, headings[i].path));
  }
  const passed: string[] = [];
  if (headingFindings.length === 0) passed.push("Headings in order");
  if (altMissing === 0) passed.push("Images have alt text");
  return { findings: [...headingFindings, ...findings], passed };
}

/** "#abc" → "#aabbcc"; 6- and 8-digit hex keep their first 6 digits; lowercase. */
export function normalizeHex(hex: string): string {
  const h = hex.slice(1).toLowerCase();
  const six = h.length === 3 || h.length === 4 ? [...h.slice(0, 3)].map((c) => c + c).join("") : h.slice(0, 6);
  return `#${six}`;
}

/** See CheckRawColors in src/contracts/engine.ts. */
export function checkRawColors(sheets: CssSheet[], tokens: Token[]): CheckFinding[] {
  const out: CheckFinding[] = [];
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      if (rule.selector === ":root") continue;
      for (const d of rule.declarations) {
        const m = /#[0-9a-f]{3,8}\b/i.exec(d.value);
        if (!m) continue;
        const hex = normalizeHex(m[0]);
        const token = tokens.find((t) => t.type === "color" && /^#[0-9a-f]{3,8}$/i.test(t.value) && normalizeHex(t.value) === hex);
        out.push({ id: `tokens:${rule.file}:${rule.line}:${d.prop}`, kind: "tokens", severity: "info", title: `Raw color ${m[0]} in ${rule.selector}`,
          detail: token ? `Use ${token.name} instead.` : "Not a token.", file: rule.file, line: rule.line, path: null });
      }
    }
  }
  return out;
}
```

2. Create `tests/engine/structure-checks.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkPageStructure, checkRawColors, normalizeHex } from "../../src/engine/checks/structure.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import type { CheckPageStructure, CheckRawColors } from "../../src/contracts/engine.ts";

const _t: [CheckPageStructure, CheckRawColors] = [checkPageStructure, checkRawColors];
void _t;
const fx = (f: string) => readFileSync(`tests/fixtures/northfield/${f}`, "utf8");

describe("structure checks", () => {
  it("passes the fixture home page", () => {
    expect(checkPageStructure(parsePage("index.html", fx("index.html")).body)).toEqual({ findings: [], passed: ["Headings in order", "Images have alt text"] });
  });
  it("finds a missing alt on the menu page", () => {
    const r = checkPageStructure(parsePage("menu.html", fx("menu.html")).body);
    expect(r.findings.map((f) => [f.id.startsWith("a11y:alt:"), f.title, f.severity])).toEqual([[true, "Image has no alt text", "warning"]]);
    expect(r.passed).toEqual(["Headings in order"]);
  });
  it("finds extra H1s and heading jumps", () => {
    const body = parsePage("a.html", "<body><h1>a</h1><h3>b</h3><h1>c</h1></body>").body;
    expect(checkPageStructure(body).findings.map((f) => [f.id, f.title, f.path])).toEqual([
      ["a11y:h1-count", "Page has 2 H1 headings", null],
      ["a11y:heading:1", "Heading jumps from H1 to H3", "1"],
    ]);
  });
});

describe("raw colors", () => {
  it("normalizes hex colors", () => {
    expect([normalizeHex("#ABC"), normalizeHex("#1e2a22ff"), normalizeHex("#Fbf8f2")]).toEqual(["#aabbcc", "#1e2a22", "#fbf8f2"]);
  });
  it("reports raw colors outside :root and suggests matching tokens", () => {
    const tokens = parseDtcg(fx("tokens.json"), "tokens.json").tokens;
    const sheets = [parseStylesheet("tokens.css", fx("tokens.css")), parseStylesheet("styles.css", fx("styles.css"))];
    const found = checkRawColors(sheets, tokens);
    expect(found.map((f) => [f.id, f.title, f.detail])).toEqual([
      ["tokens:styles.css:22:color", "Raw color #1e2a22 in .hero h1", "Use color.ink instead."],
      ["tokens:styles.css:35:color", "Raw color #4a544c in .lede", "Use color.muted instead."],
      ["tokens:styles.css:37:color", "Raw color #f3eee4 in .order-button", "Use color.cream instead."],
      ["tokens:styles.css:49:background-color", "Raw color #fbf8f2 in .card", "Not a token."],
      ["tokens:styles.css:51:color", "Raw color #4a544c in .footer", "Use color.muted instead."],
    ]);
    expect(found.every((f) => f.kind === "tokens" && f.severity === "info" && f.path === null)).toBe(true);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL pass the fixture home page and flag the menu page's image without alt. (test: "finds a missing alt on the menu page")
- THE SYSTEM SHALL report extra H1s and heading level jumps. (test: "finds extra H1s and heading jumps")
- THE SYSTEM SHALL report raw colors outside :root with the matching token name or "Not a token.". (test: "reports raw colors outside :root and suggests matching tokens")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T066`.
The last line must be `GATE PASS T066`. On `GATE FAIL T066 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T066` prints `GATE PASS T066`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T066: Check page structure and raw colors
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
