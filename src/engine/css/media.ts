import Specificity from "@bramus/specificity";
import type { Specificity as Spec } from "../../contracts/model.ts";

function termApplies(term: string, width: number): boolean {
  if (term === "all" || term === "screen" || term === "only screen") return true;
  const m = /^\(\s*(max|min)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)$/.exec(term);
  if (!m) return false;
  const px = Number(m[2]) * (m[3] === "px" ? 1 : 16);
  return m[1] === "max" ? width <= px : width >= px;
}

/** See MediaApplies in src/contracts/engine.ts. */
export function mediaApplies(media: string | null, width: number): boolean {
  if (media === null) return true;
  return media.split(",").some((part) => {
    const terms = part.trim().toLowerCase().split(/\s+and\s+/);
    return terms.every((t) => termApplies(t.trim(), width));
  });
}

/** [a, b, c] of one complex selector; [0, 0, 0] when it cannot be parsed. */
export function specificityOf(selector: string): Spec {
  try {
    const v = Specificity.calculate(selector)[0].value;
    return [v.a, v.b, v.c];
  } catch {
    return [0, 0, 0];
  }
}

/** Positive when x is more specific than y, negative when less, 0 when equal. */
export function compareSpecificity(x: Spec, y: Spec): number {
  return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);
}

/** Split on commas outside (), [] and quotes; trim; drop empty parts. */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const ch of list) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "\"" || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
