import postcss from "postcss";
import type { AtRule, Declaration, Root, Rule } from "postcss";
import { MasonError } from "../../contracts/errors.ts";
import type { CssDeclaration, CssMediaBlock, CssRule, CssSheet } from "../../contracts/model.ts";

export function normalizeMedia(params: string): string {
  return params.toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s*:\s*/g, ": ");
}

export function parseStylesheet(file: string, text: string): CssSheet {
  let root: Root;
  try {
    root = postcss.parse(text, { from: file });
  } catch (error) {
    if ((error as { name?: string }).name === "CssSyntaxError") {
      throw new MasonError("CSS_PARSE_ERROR", `${file}:${(error as { line?: number }).line ?? 1}`);
    }
    throw error;
  }
  const rules: CssRule[] = [];
  const mediaBlocks: CssMediaBlock[] = [];
  const addRule = (rule: Rule, media: string | null) => {
    const range = { start: rule.source!.start!.offset, end: rule.source!.end!.offset };
    const bodyRange = { start: text.indexOf("{", range.start) + 1, end: range.end - 1 };
    const declarations = (rule.nodes ?? []).filter((n): n is Declaration => n.type === "decl").map(toDeclaration);
    rules.push({
      file,
      index: rules.length,
      selector: rule.selector.trim(),
      media,
      line: rule.source!.start!.line,
      declarations,
      range,
      bodyRange,
    });
  };
  for (const node of root.nodes) {
    if (node.type === "rule") addRule(node, null);
    else if (node.type === "atrule" && node.name.toLowerCase() === "media") {
      const media = normalizeMedia(node.params);
      const range = { start: node.source!.start!.offset, end: node.source!.end!.offset };
      mediaBlocks.push({ file, media, range, bodyEnd: node.source!.end!.offset - 1 });
      for (const child of node.nodes ?? []) {
        if (child.type === "rule") addRule(child, media);
      }
    }
  }
  return { file, text, rules, mediaBlocks };
}

function toDeclaration(decl: Declaration): CssDeclaration {
  const range = { start: decl.source!.start!.offset, end: decl.source!.end!.offset };
  const valueStart = range.start + decl.prop.length + (decl.raws.between ?? "").length;
  const valueRange = { start: valueStart, end: valueStart + (decl.raws.value?.raw ?? decl.value).length };
  return {
    prop: decl.prop.toLowerCase(),
    value: decl.value,
    important: decl.important === true,
    range,
    valueRange,
  };
}
void (null as unknown as AtRule);
