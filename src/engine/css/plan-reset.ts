import type { SourceRange, TextEdit } from "../../contracts/model.ts";
import type { PlanResetInput } from "../../contracts/engine.ts";
import { resolveCascade } from "./cascade.ts";
import { scopeMedia } from "./plan-style.ts";

/** Removal range of an item: from the "\n" before it when only spaces/tabs separate them, to its end. */
export function removalRange(text: string, item: SourceRange): SourceRange {
  let k = item.start;
  while (k > 0 && (text[k - 1] === " " || text[k - 1] === "\t")) k -= 1;
  return { start: k > 0 && text[k - 1] === "\n" ? k - 1 : item.start, end: item.end };
}

/** See PlanResetOverride in src/contracts/engine.ts. */
export function planResetOverride(input: PlanResetInput): TextEdit[] {
  const { sheets, el, prop, scope } = input;
  if (scope === "all") return [];
  const { media: M, width } = scopeMedia(scope);
  const entries = resolveCascade(sheets, el, prop, width).filter((e) => e.applies && e.rule.media === M);
  const edits: TextEdit[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    const mine = entries.filter((e) => e.sheetIndex === sheetIndex);
    if (mine.length === 0) return;
    const removedDecls = new Map<number, Set<number>>();
    for (const e of mine) {
      if (!removedDecls.has(e.rule.index)) removedDecls.set(e.rule.index, new Set());
      removedDecls.get(e.rule.index)!.add(e.declIndex);
    }
    const wholeRules = new Set<number>();
    for (const [ruleIndex, decls] of removedDecls) {
      if (decls.size === sheet.rules[ruleIndex].declarations.length) wholeRules.add(ruleIndex);
    }
    const coveredRules = new Set<number>();
    for (const block of sheet.mediaBlocks) {
      const inside = sheet.rules.filter((r) => r.range.start >= block.range.start && r.range.end <= block.range.end);
      if (inside.length > 0 && inside.every((r) => wholeRules.has(r.index))) {
        const r = removalRange(sheet.text, block.range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
        inside.forEach((x) => coveredRules.add(x.index));
      }
    }
    for (const [ruleIndex, decls] of removedDecls) {
      if (coveredRules.has(ruleIndex)) continue;
      const rule = sheet.rules[ruleIndex];
      if (wholeRules.has(ruleIndex)) {
        const r = removalRange(sheet.text, rule.range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
        continue;
      }
      for (const d of decls) {
        const r = removalRange(sheet.text, rule.declarations[d].range);
        edits.push({ file: sheet.file, start: r.start, end: r.end, text: "" });
      }
    }
  });
  return edits.sort((a, b) => a.start - b.start);
}
