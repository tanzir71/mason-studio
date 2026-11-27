import { MasonError } from "../../contracts/errors.ts";
import { INSERT_SNIPPETS, INSERT_STYLES } from "../../contracts/engine.ts";
import type { InsertPlan, PageModel } from "../../contracts/engine.ts";
import type { ElementPath, InsertKind, TextEdit } from "../../contracts/model.ts";
import { planAppendRule } from "../css/edits.ts";
import { indentOf, planRemoveElement, requireNode } from "./edit.ts";
import { nextClassName } from "./select.ts";

const childPath = (parent: ElementPath, i: number): ElementPath => (parent === "" ? String(i) : `${parent}.${i}`);
const parentOf = (path: ElementPath): ElementPath => (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "");
const byStart = (a: TextEdit, b: TextEdit) => a.start - b.start;

/** See PlanInsertElement in src/contracts/engine.ts. */
export function planInsertElement(page: PageModel, html: string, css: { file: string; text: string } | null,
  parentPath: ElementPath, index: number, kind: InsertKind): InsertPlan {
  if (!(kind in INSERT_SNIPPETS)) throw new MasonError("INVALID_INPUT", kind);
  const parent = requireNode(page, parentPath);
  if (!parent.innerRange) throw new MasonError("INVALID_INPUT", parentPath);
  if (!css) throw new MasonError("NO_STYLESHEET", page.file);
  const className = nextClassName(page.body, kind);
  const snippet = INSERT_SNIPPETS[kind].replace("{cls}", className);
  const count = parent.children.length;
  const idx = Math.min(Math.max(Math.trunc(index), 0), count);
  let edit: TextEdit;
  if (idx < count) {
    const child = parent.children[idx];
    edit = { file: page.file, start: child.range.start, end: child.range.start, text: `${snippet}\n${indentOf(html, child)}` };
  } else if (count > 0) {
    const last = parent.children[count - 1];
    edit = { file: page.file, start: last.range.end, end: last.range.end, text: `\n${indentOf(html, last)}${snippet}` };
  } else {
    const p = indentOf(html, parent);
    const inner = html.slice(parent.innerRange.start, parent.innerRange.end);
    const text = `\n${p}  ${snippet}\n${p}`;
    edit = /^\s*$/.test(inner)
      ? { file: page.file, start: parent.innerRange.start, end: parent.innerRange.end, text }
      : { file: page.file, start: parent.innerRange.end, end: parent.innerRange.end, text };
  }
  const rule = planAppendRule(css.file, css.text, `.${className}`, INSERT_STYLES[kind]);
  return { edits: [edit, rule], className, path: childPath(parentPath, idx) };
}

/** See PlanMoveElement in src/contracts/engine.ts. */
export function planMoveElement(page: PageModel, html: string, path: ElementPath, toIndex: number): { edits: TextEdit[]; path: ElementPath } {
  const node = requireNode(page, path);
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be moved.");
  const parentPath = parentOf(path);
  const siblings = requireNode(page, parentPath).children;
  const from = Number(path.slice(path.lastIndexOf(".") + 1));
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), siblings.length - 1);
  if (from === to) return { edits: [], path };
  const text = html.slice(node.range.start, node.range.end);
  const sib = siblings[to];
  const insert: TextEdit = to < from
    ? { file: page.file, start: sib.range.start, end: sib.range.start, text: `${text}\n${indentOf(html, sib)}` }
    : { file: page.file, start: sib.range.end, end: sib.range.end, text: `\n${indentOf(html, sib)}${text}` };
  return { edits: [...planRemoveElement(page, html, path), insert].sort(byStart), path: childPath(parentPath, to) };
}

/** See PlanWrapInStack in src/contracts/engine.ts. */
export function planWrapInStack(page: PageModel, html: string, css: { file: string; text: string } | null, path: ElementPath): InsertPlan {
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be wrapped.");
  const node = requireNode(page, path);
  if (!css) throw new MasonError("NO_STYLESHEET", page.file);
  const className = nextClassName(page.body, "stack");
  const edits: TextEdit[] = [
    { file: page.file, start: node.range.start, end: node.range.start, text: `<div class="${className}">` },
    { file: page.file, start: node.range.end, end: node.range.end, text: "</div>" },
    planAppendRule(css.file, css.text, `.${className}`, [["display", "flex"], ["flex-direction", "column"], ["gap", "16px"]]),
  ];
  return { edits, className, path };
}
