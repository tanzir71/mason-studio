# T052: Read and write DTCG design tokens

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T052 (build), phase 6 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R25 |

**Create:** `src/engine/tokens/dtcg.ts`, `tests/engine/tokens-dtcg.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T052`):

1. `npx vitest run tests/engine/tokens-dtcg.test.ts` -> exit 0, output contains `Tests  6 passed (6)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parseDtcg`, `serializeDtcg` and `cssVarName` convert between DTCG 2025.10 JSON and Mason's TokenSet.

## Context

Engine module, tokens area. tokens.json in a project is DTCG; Mason also reads its own `dev.mason.breakpoints` extension for per-breakpoint values. Shared helpers (`isObject`, `finishTokens`, `RawToken`) are exported for the Tokens Studio importer (T053). Pure functions: no I/O. Token names use dots (`color.ink`); CSS variables use dashes (`--color-ink`).

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * parseDtcg(json, file): DTCG 2025.10. Nested groups; a token is an object with "$value". "$type" inherits
 * from the nearest group. Types other than TokenType are skipped. Values → CSS text:
 *   color: "#rrggbb" string, or { colorSpace: "srgb", components: [r,g,b] (0..1), alpha?, hex? } → hex when
 *          given else from components (lowercase "#rrggbb", "#rrggbbaa" when alpha < 1);
 *   dimension: "16px" string or { value, unit } → `${value}${unit}`; fontFamily: string or string[] joined ", ";
 *   fontWeight/number: String(value). "{a.b}" values → alias "a.b" and value = the resolved value of a.b.
 * byBreakpoint = $extensions["dev.mason.breakpoints"] mapped through the same conversion.
 * tokens sorted by name. Invalid JSON or an unresolved alias → MasonError("TOKENS_INVALID", detail).
 */
export type ParseDtcg = (json: string, file: string | null) => TokenSet;
/** serializeDtcg(set): nested groups by name segments; colors as { colorSpace: "srgb", components, hex }; dimensions as { value, unit }; aliases as "{name}"; JSON.stringify(..., null, 2) + "\n". */
export type SerializeDtcg = (set: TokenSet) => string;
/** "color.ink" → "--color-ink" (dots and spaces → "-", lowercase). */
export type CssVarName = (tokenName: string) => string;
```

```ts
// src/contracts/model.ts
export type TokenType = "color" | "dimension" | "fontFamily" | "fontWeight" | "number";
export interface Token {
  name: string;                 // dot path, e.g. "color.ink"
  type: TokenType;
  value: string;                // CSS text: "#1e2a22", "16px", "Fraunces, serif", "600", "1.5"
  alias: string | null;         // "color.ink" when $value was "{color.ink}", else null
  byBreakpoint: Partial<Record<BreakpointId, string>>; // from $extensions["dev.mason.breakpoints"]
}
export interface TokenSet { tokens: Token[]; file: string | null }
```

## Current state

`src/engine/tokens/` does not exist. `tests/fixtures/northfield/tokens.json` holds 8 tokens (colors with object and string values, a font array, dimensions, and `type.display` with breakpoint values).

## Steps

1. Create `src/engine/tokens/dtcg.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { BreakpointId, Token, TokenSet, TokenType } from "../../contracts/model.ts";

export const TOKEN_TYPES: readonly TokenType[] = ["color", "dimension", "fontFamily", "fontWeight", "number"];
const BP_IDS: readonly BreakpointId[] = ["desktop", "tablet", "mobile"];
const ALIAS = /^\{([^}]+)\}$/;

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hex2 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, "0");

/** "color.ink" → "--color-ink": dots and spaces become "-", lowercase. */
export function cssVarName(tokenName: string): string {
  return "--" + tokenName.replace(/[.\s]+/g, "-").toLowerCase();
}

/** One DTCG $value as CSS text for its type (see ParseDtcg). Throws TOKENS_INVALID for other shapes. */
export function dtcgValueToCss(type: TokenType, value: unknown, name: string): string {
  if (type === "color") {
    if (typeof value === "string") return value.trim().toLowerCase();
    if (isObject(value) && typeof value.hex === "string") return value.hex.toLowerCase();
    if (isObject(value) && Array.isArray(value.components) && value.components.length === 3) {
      const [r, g, b] = value.components as number[];
      const alpha = typeof value.alpha === "number" ? value.alpha : 1;
      return `#${hex2(r)}${hex2(g)}${hex2(b)}${alpha < 1 ? hex2(alpha) : ""}`;
    }
  }
  if (type === "dimension") {
    if (typeof value === "string") return value.trim();
    if (isObject(value) && typeof value.value === "number" && typeof value.unit === "string") return `${value.value}${value.unit}`;
  }
  if (type === "fontFamily") {
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(String).join(", ");
  }
  if ((type === "fontWeight" || type === "number") && (typeof value === "string" || typeof value === "number")) return String(value);
  throw new MasonError("TOKENS_INVALID", `value of ${name}`);
}

export interface RawToken { name: string; type: TokenType; value: string | null; alias: string | null; byBreakpoint: Partial<Record<BreakpointId, string>> }

/** Resolves aliases to their target's value (chains allowed), sorts by name. Unknown or circular alias → TOKENS_INVALID. */
export function finishTokens(raw: RawToken[]): Token[] {
  const byName = new Map(raw.map((t) => [t.name, t]));
  const resolve = (t: RawToken, depth: number): string => {
    if (t.alias === null) return t.value ?? "";
    const target = byName.get(t.alias);
    if (!target || depth > 10) throw new MasonError("TOKENS_INVALID", `alias ${t.alias}`);
    return resolve(target, depth + 1);
  };
  return raw
    .map((t) => ({ name: t.name, type: t.type, value: resolve(t, 0), alias: t.alias, byBreakpoint: t.byBreakpoint }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** See ParseDtcg in src/contracts/engine.ts. */
export function parseDtcg(json: string, file: string | null): TokenSet {
  let root: unknown;
  try { root = JSON.parse(json); } catch { throw new MasonError("TOKENS_INVALID", "not JSON"); }
  if (!isObject(root)) throw new MasonError("TOKENS_INVALID", "not an object");
  const raw: RawToken[] = [];
  const walk = (group: Record<string, unknown>, path: string[], inherited: unknown) => {
    for (const key of Object.keys(group)) {
      if (key.startsWith("$")) continue;
      const node = group[key];
      if (!isObject(node)) continue;
      const name = [...path, key].join(".");
      const type = node.$type ?? inherited;
      if (!("$value" in node)) { walk(node, [...path, key], type); continue; }
      if (!TOKEN_TYPES.includes(type as TokenType)) continue;
      const t = type as TokenType;
      const v = node.$value;
      const m = typeof v === "string" ? ALIAS.exec(v.trim()) : null;
      const ext = isObject(node.$extensions) ? node.$extensions["dev.mason.breakpoints"] : undefined;
      const byBreakpoint: Partial<Record<BreakpointId, string>> = {};
      if (isObject(ext)) for (const bp of BP_IDS) if (ext[bp] !== undefined) byBreakpoint[bp] = dtcgValueToCss(t, ext[bp], name);
      raw.push({ name, type: t, value: m ? null : dtcgValueToCss(t, v, name), alias: m ? m[1] : null, byBreakpoint });
    }
  };
  walk(root, [], undefined);
  return { tokens: finishTokens(raw), file };
}

function hexToComponents(hex: string): { components: number[]; alpha?: number } | null {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) return null;
  const c = [0, 2, 4].map((i) => Math.round((parseInt(m[1].slice(i, i + 2), 16) / 255) * 10000) / 10000);
  return m[2] ? { components: c, alpha: Math.round((parseInt(m[2], 16) / 255) * 10000) / 10000 } : { components: c };
}

function toDtcgValue(t: Token): unknown {
  if (t.alias) return `{${t.alias}}`;
  if (t.type === "color") {
    const c = hexToComponents(t.value);
    return c ? { colorSpace: "srgb", ...c, hex: t.value } : t.value;
  }
  if (t.type === "dimension") {
    const m = /^(-?\d*\.?\d+)([a-z%]+)$/i.exec(t.value);
    return m ? { value: Number(m[1]), unit: m[2] } : t.value;
  }
  if (t.type === "fontFamily") return t.value.split(",").map((s) => s.trim()).filter(Boolean);
  return /^-?\d*\.?\d+$/.test(t.value) ? Number(t.value) : t.value;
}

/** See SerializeDtcg in src/contracts/engine.ts. */
export function serializeDtcg(set: TokenSet): string {
  const root: Record<string, unknown> = {};
  for (const t of set.tokens) {
    const parts = t.name.split(".");
    let group = root;
    for (const p of parts.slice(0, -1)) {
      if (!isObject(group[p])) group[p] = {};
      group = group[p] as Record<string, unknown>;
    }
    const leaf: Record<string, unknown> = { $type: t.type, $value: toDtcgValue(t) };
    if (Object.keys(t.byBreakpoint).length > 0) leaf.$extensions = { "dev.mason.breakpoints": { ...t.byBreakpoint } };
    group[parts[parts.length - 1]] = leaf;
  }
  return JSON.stringify(root, null, 2) + "\n";
}
```

2. Create `tests/engine/tokens-dtcg.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cssVarName, parseDtcg, serializeDtcg } from "../../src/engine/tokens/dtcg.ts";
import type { CssVarName, ParseDtcg, SerializeDtcg } from "../../src/contracts/engine.ts";

const _t: [ParseDtcg, SerializeDtcg, CssVarName] = [parseDtcg, serializeDtcg, cssVarName];
void _t;
const fixture = readFileSync("tests/fixtures/northfield/tokens.json", "utf8");

describe("parseDtcg", () => {
  it("reads the fixture with inherited types, objects and arrays", () => {
    const set = parseDtcg(fixture, "tokens.json");
    expect(set.file).toBe("tokens.json");
    expect(set.tokens.map((t) => [t.name, t.type, t.value])).toEqual([
      ["color.cream", "color", "#f3eee4"], ["color.ink", "color", "#1e2a22"], ["color.muted", "color", "#4a544c"],
      ["color.rust", "color", "#b4532a"], ["font.display", "fontFamily", "Fraunces, Georgia, serif"],
      ["space.4", "dimension", "16px"], ["space.6", "dimension", "32px"], ["type.display", "dimension", "40px"],
    ]);
    expect(set.tokens[7].byBreakpoint).toEqual({ tablet: "32px", mobile: "28px" });
  });
  it("resolves aliases and converts color components", () => {
    const set = parseDtcg(JSON.stringify({
      a: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0.5], alpha: 0.5 } },
      b: { $type: "color", $value: "{a}" },
      skip: { $type: "shadow", $value: "x" },
    }), null);
    expect(set.tokens).toEqual([
      { name: "a", type: "color", value: "#ff008080", alias: null, byBreakpoint: {} },
      { name: "b", type: "color", value: "#ff008080", alias: "a", byBreakpoint: {} },
    ]);
  });
  it("rejects invalid JSON and unknown aliases", () => {
    expect(() => parseDtcg("{", null)).toThrow("The tokens file could not be read.");
    expect(() => parseDtcg('{ "a": { "$type": "color", "$value": "{nope}" } }', null)).toThrow("The tokens file could not be read. alias nope");
  });
  it("names CSS variables", () => {
    expect(cssVarName("color.ink")).toBe("--color-ink");
    expect(cssVarName("Space Big.2")).toBe("--space-big-2");
  });
});

describe("serializeDtcg", () => {
  it("round-trips through parseDtcg", () => {
    const set = parseDtcg(fixture, "tokens.json");
    expect(parseDtcg(serializeDtcg(set), "tokens.json")).toEqual(set);
  });
  it("writes nested groups with DTCG objects", () => {
    const json = JSON.parse(serializeDtcg({ file: null, tokens: [
      { name: "space.4", type: "dimension", value: "16px", alias: null, byBreakpoint: {} },
      { name: "space.gap", type: "dimension", value: "16px", alias: "space.4", byBreakpoint: {} },
    ] }));
    expect(json).toEqual({ space: { "4": { $type: "dimension", $value: { value: 16, unit: "px" } }, gap: { $type: "dimension", $value: "{space.4}" } } });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL read nested groups with inherited $type, color objects, dimension objects and font arrays, sorted by name. (test: "reads the fixture with inherited types, objects and arrays")
- THE SYSTEM SHALL resolve "{a.b}" aliases and reject unknown ones with TOKENS_INVALID. (test: "rejects invalid JSON and unknown aliases")
- THE SYSTEM SHALL round-trip a TokenSet through serializeDtcg and parseDtcg. (test: "round-trips through parseDtcg")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T052`.
The last line must be `GATE PASS T052`. On `GATE FAIL T052 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T052` prints `GATE PASS T052`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T052: Read and write DTCG design tokens
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
