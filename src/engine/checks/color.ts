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
