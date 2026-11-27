import type { CascadeEntry, CssSheet, ElementMatcher, RuleMatch } from "../../contracts/model.ts";
import { compareSpecificity, mediaApplies, specificityOf, splitSelectorList } from "./media.ts";

/** See MatchingRules in src/contracts/engine.ts. */
export function matchingRules(sheets: CssSheet[], el: ElementMatcher, width: number): RuleMatch[] {
  const out: RuleMatch[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    for (const rule of sheet.rules) {
      let best: { selector: string; spec: [number, number, number] } | null = null;
      for (const selector of splitSelectorList(rule.selector)) {
        let ok = false;
        try { ok = el.matches(selector); } catch { ok = false; }
        if (!ok) continue;
        const spec = specificityOf(selector);
        if (!best || compareSpecificity(spec, best.spec) > 0) best = { selector, spec };
      }
      if (best) out.push({ rule, selector: best.selector, specificity: best.spec, sheetIndex, applies: mediaApplies(rule.media, width) });
    }
  });
  return out.sort((x, y) =>
    (Number(y.applies) - Number(x.applies)) || compareSpecificity(y.specificity, x.specificity) ||
    (y.sheetIndex - x.sheetIndex) || (y.rule.index - x.rule.index));
}

/** See ResolveCascade in src/contracts/engine.ts. */
export function resolveCascade(sheets: CssSheet[], el: ElementMatcher, prop: string, width: number): CascadeEntry[] {
  const entries: CascadeEntry[] = [];
  for (const m of matchingRules(sheets, el, width)) {
    m.rule.declarations.forEach((declaration, declIndex) => {
      if (declaration.prop === prop) entries.push({ ...m, declaration, declIndex, winning: false });
    });
  }
  entries.sort((x, y) =>
    (Number(y.applies) - Number(x.applies)) || (Number(y.declaration.important) - Number(x.declaration.important)) ||
    compareSpecificity(y.specificity, x.specificity) || (y.sheetIndex - x.sheetIndex) ||
    (y.rule.index - x.rule.index) || (y.declIndex - x.declIndex));
  if (entries[0]?.applies) entries[0].winning = true;
  return entries;
}
