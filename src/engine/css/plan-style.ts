import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS } from "../../contracts/model.ts";
import type { CssRule, CssSheet, TextEdit } from "../../contracts/model.ts";
import type { PlanStyleInput } from "../../contracts/engine.ts";
import { matchingRules, resolveCascade } from "./cascade.ts";
import { appendEdit } from "./edits.ts";

/** `(max-width: Npx)` and the evaluation width for a tablet/mobile scope. */
export function scopeMedia(scope: "tablet" | "mobile"): { media: string; width: number; maxWidth: number } {
  const bp = BREAKPOINTS.find((b) => b.id === scope)!;
  return { media: `(max-width: ${bp.maxWidth}px)`, width: bp.width, maxWidth: bp.maxWidth! };
}

/** Insert `prop: value;` into rule R (see "Insert a declaration" in PlanStyleEdit). */
export function insertDeclaration(text: string, rule: CssRule, prop: string, value: string): TextEdit {
  const file = rule.file;
  const body = text.slice(rule.bodyRange.start, rule.bodyRange.end);
  const decls = rule.declarations;
  const last = decls[decls.length - 1];
  const lastText = last ? text.slice(last.range.start, last.range.end) : "";
  if (!body.includes("\n")) {
    if (!last) return { file, start: rule.bodyRange.start, end: rule.bodyRange.end, text: ` ${prop}: ${value}; ` };
    return { file, start: last.range.end, end: last.range.end, text: (lastText.endsWith(";") ? "" : ";") + ` ${prop}: ${value};` };
  }
  let indent = "  ";
  if (decls[0]) {
    const lineStart = text.lastIndexOf("\n", decls[0].range.start - 1) + 1;
    const ws = text.slice(lineStart, decls[0].range.start);
    if (/^[ \t]*$/.test(ws)) indent = ws;
  }
  const at = last ? last.range.end : rule.bodyRange.start;
  return { file, start: at, end: at, text: (last && !lastText.endsWith(";") ? ";" : "") + `\n${indent}${prop}: ${value};` };
}

/** See PlanStyleEdit in src/contracts/engine.ts. */
export function planStyleEdit(input: PlanStyleInput): TextEdit[] {
  const { sheets, el, elementSelector, prop, scope, defaultFile } = input;
  const value = input.value.trim();
  if (value === "" || /[;{}]/.test(value)) throw new MasonError("INVALID_INPUT", input.value);
  const textOf = (file: string): string => sheets.find((s) => s.file === file)?.text ?? "";
  const replace = (file: string, start: number, end: number): TextEdit[] => [{ file, start, end, text: value }];

  if (scope === "all") {
    const win = resolveCascade(sheets, el, prop, 1280).find((e) => e.winning);
    if (win) return replace(win.rule.file, win.declaration.valueRange.start, win.declaration.valueRange.end);
    const base = matchingRules(sheets, el, 1280).find((m) => m.applies && m.rule.media === null);
    if (base) return [insertDeclaration(textOf(base.rule.file), base.rule, prop, value)];
    return [appendEdit(defaultFile, textOf(defaultFile), `${elementSelector} {\n  ${prop}: ${value};\n}\n`)];
  }

  const { media: M, width, maxWidth } = scopeMedia(scope);
  const cascade = resolveCascade(sheets, el, prop, width);
  const inM = cascade.find((e) => e.applies && e.rule.media === M);
  if (inM) return replace(inM.rule.file, inM.declaration.valueRange.start, inM.declaration.valueRange.end);
  const ruleM = matchingRules(sheets, el, width).find((m) => m.applies && m.rule.media === M);
  if (ruleM) return [insertDeclaration(textOf(ruleM.rule.file), ruleM.rule, prop, value)];

  const base = cascade.find((e) => e.applies && e.rule.media === null);
  const sel = base?.selector ?? elementSelector;
  const file = base?.rule.file ?? defaultFile;
  const sheet: CssSheet | undefined = sheets.find((s) => s.file === file);
  const text = sheet?.text ?? "";
  const blocks = (sheet?.mediaBlocks ?? []).filter((b) => b.media === M && (!base || b.bodyEnd > base.rule.range.end));
  const block = blocks[blocks.length - 1];
  if (block) {
    const prefix = text[block.bodyEnd - 1] === "\n" ? "" : "\n";
    return [{ file, start: block.bodyEnd, end: block.bodyEnd, text: `${prefix}  ${sel} {\n    ${prop}: ${value};\n  }\n` }];
  }
  return [appendEdit(file, text, `\n@media (max-width: ${maxWidth}px) {\n  ${sel} {\n    ${prop}: ${value};\n  }\n}\n`)];
}
