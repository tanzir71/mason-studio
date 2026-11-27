# T053: Import Tokens Studio and Penpot token files

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T053 (build), phase 6 |
| Depends on | T052 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R25 |

**Create:** `src/engine/tokens/tokens-studio.ts`, `tests/engine/tokens-studio.test.ts`

**Modify:** none

**Read only:** `src/engine/tokens/dtcg.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T053`):

1. `npx vitest run tests/engine/tokens-studio.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`fromTokensStudio(json)` turns a Tokens Studio / Penpot export into a TokenSet.

## Context

Engine module, tokens area. Penpot and Tokens Studio export the same format: sets of `{ value, type }` objects, with `$metadata.tokenSetOrder`. Pure functions: no I/O. Token names use dots (`color.ink`); CSS variables use dashes (`--color-ink`).

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * fromTokensStudio(json): Tokens Studio / Penpot export. Top-level keys starting with "$" are metadata; every
 * other top-level key is a set, read in $metadata.tokenSetOrder order when present, else key order. Inside a set,
 * a token is an object with "value" and "type". Names drop the set name. First set wins on duplicate names.
 * type map: color → color; spacing, sizing, dimension, borderRadius, borderWidth, fontSizes, letterSpacing →
 * dimension (a bare number gets "px"); fontFamilies → fontFamily; fontWeights → fontWeight;
 * lineHeights, opacity, number → number; others skipped. "{a.b}" → alias. Errors → TOKENS_INVALID.
 */
export type FromTokensStudio = (json: string) => TokenSet;
```

```ts
// src/contracts/model.ts
export interface TokenSet { tokens: Token[]; file: string | null }
```

## Current state

`src/engine/tokens/dtcg.ts` exports `isObject`, `finishTokens(raw)` (resolves aliases, sorts) and the `RawToken` type.

## Steps

1. Create `src/engine/tokens/tokens-studio.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { TokenSet, TokenType } from "../../contracts/model.ts";
import { finishTokens, isObject } from "./dtcg.ts";
import type { RawToken } from "./dtcg.ts";

const TYPE_MAP: Record<string, TokenType> = {
  color: "color", spacing: "dimension", sizing: "dimension", dimension: "dimension", borderRadius: "dimension",
  borderWidth: "dimension", fontSizes: "dimension", letterSpacing: "dimension", fontFamilies: "fontFamily",
  fontWeights: "fontWeight", lineHeights: "number", opacity: "number", number: "number",
};
const ALIAS = /^\{([^}]+)\}$/;

function studioValue(type: TokenType, value: unknown, name: string): string {
  if (type === "dimension" && (typeof value === "number" || (typeof value === "string" && /^-?\d*\.?\d+$/.test(value.trim())))) return `${String(value).trim()}px`;
  if (type === "fontFamily" && Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string") return type === "color" ? value.trim().toLowerCase() : value.trim();
  if (typeof value === "number") return String(value);
  throw new MasonError("TOKENS_INVALID", `value of ${name}`);
}

/** See FromTokensStudio in src/contracts/engine.ts. */
export function fromTokensStudio(json: string): TokenSet {
  let root: unknown;
  try { root = JSON.parse(json); } catch { throw new MasonError("TOKENS_INVALID", "not JSON"); }
  if (!isObject(root)) throw new MasonError("TOKENS_INVALID", "not an object");
  const sets = Object.keys(root).filter((k) => !k.startsWith("$"));
  const meta = isObject(root.$metadata) && Array.isArray(root.$metadata.tokenSetOrder) ? (root.$metadata.tokenSetOrder as unknown[]).map(String) : null;
  const order = meta ? meta.filter((s) => sets.includes(s)) : sets;
  const raw: RawToken[] = [];
  const seen = new Set<string>();
  const walk = (node: Record<string, unknown>, path: string[]) => {
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (!isObject(child)) continue;
      const name = [...path, key].join(".");
      if (!("value" in child && "type" in child)) { walk(child, [...path, key]); continue; }
      const type = TYPE_MAP[String(child.type)];
      if (!type || seen.has(name)) continue;
      seen.add(name);
      const m = typeof child.value === "string" ? ALIAS.exec(child.value.trim()) : null;
      raw.push({ name, type, value: m ? null : studioValue(type, child.value, name), alias: m ? m[1] : null, byBreakpoint: {} });
    }
  };
  for (const set of order) if (isObject(root[set])) walk(root[set] as Record<string, unknown>, []);
  return { tokens: finishTokens(raw), file: null };
}
```

2. Create `tests/engine/tokens-studio.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { fromTokensStudio } from "../../src/engine/tokens/tokens-studio.ts";
import type { FromTokensStudio } from "../../src/contracts/engine.ts";

const _t: FromTokensStudio = fromTokensStudio;
void _t;
const studio = JSON.stringify({
  brand: { color: { primary: { value: "#B4532A", type: "color" } }, radius: { md: { value: "8", type: "borderRadius" } } },
  core: { color: { primary: { value: "#000000", type: "color" }, link: { value: "{color.primary}", type: "color" } }, space: { "2": { value: 8, type: "spacing" } } },
  $metadata: { tokenSetOrder: ["brand", "core"] },
  $themes: [],
});

describe("fromTokensStudio", () => {
  it("reads sets in tokenSetOrder, first set winning", () => {
    expect(fromTokensStudio(studio).tokens.map((t) => [t.name, t.type, t.value, t.alias])).toEqual([
      ["color.link", "color", "#b4532a", "color.primary"],
      ["color.primary", "color", "#b4532a", null],
      ["radius.md", "dimension", "8px", null],
      ["space.2", "dimension", "8px", null],
    ]);
  });
  it("maps font families and skips unknown types", () => {
    const set = fromTokensStudio(JSON.stringify({ g: { body: { value: ["Inter", "sans-serif"], type: "fontFamilies" }, shadow: { value: "x", type: "boxShadow" } } }));
    expect(set).toEqual({ file: null, tokens: [{ name: "body", type: "fontFamily", value: "Inter, sans-serif", alias: null, byBreakpoint: {} }] });
  });
  it("rejects invalid JSON", () => {
    expect(() => fromTokensStudio("nope")).toThrow("The tokens file could not be read.");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL read sets in tokenSetOrder with the first set winning on duplicate names, mapping types and adding px to bare dimensions. (test: "reads sets in tokenSetOrder, first set winning")
- THE SYSTEM SHALL skip unsupported token types. (test: "maps font families and skips unknown types")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T053`.
The last line must be `GATE PASS T053`. On `GATE FAIL T053 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T053` prints `GATE PASS T053`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T053: Import Tokens Studio and Penpot token files
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
