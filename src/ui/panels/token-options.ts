import type { InspectProp, Token, TokenSet, TokenType } from "../../contracts/model.ts";

/** Token type offered for each Design panel property; properties not listed get no token suggestions. */
export const PROP_TOKEN_TYPE: Partial<Record<InspectProp, TokenType>> = {
  "color": "color", "background-color": "color",
  "width": "dimension", "height": "dimension", "max-width": "dimension", "gap": "dimension", "padding": "dimension",
  "margin": "dimension", "font-size": "dimension", "letter-spacing": "dimension", "border-radius": "dimension",
  "font-family": "fontFamily", "font-weight": "fontWeight", "line-height": "number", "opacity": "number",
};

/** "color.ink" → "--color-ink" (same rule as the engine's cssVarName). */
export function tokenVar(name: string): string {
  return "--" + name.replace(/[.\s]+/g, "-").toLowerCase();
}

/** `var(--name)` suggestions for a property, in token order. */
export function tokenOptions(tokens: TokenSet | null, prop: InspectProp): string[] {
  const type = PROP_TOKEN_TYPE[prop];
  if (!tokens || !type) return [];
  return tokens.tokens.filter((t) => t.type === type).map((t) => `var(${tokenVar(t.name)})`);
}

/** The token a `var(--x)` value points at, or null. */
export function tokenForValue(tokens: TokenSet | null, value: string): Token | null {
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
  if (!m || !tokens) return null;
  return tokens.tokens.find((t) => tokenVar(t.name) === m[1]) ?? null;
}
