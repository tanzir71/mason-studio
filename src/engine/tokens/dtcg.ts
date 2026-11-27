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
