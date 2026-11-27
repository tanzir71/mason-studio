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
