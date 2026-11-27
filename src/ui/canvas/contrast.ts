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
