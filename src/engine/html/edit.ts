import { MasonError } from "../../contracts/errors.ts";
import type { ElementNode, ElementPath, TextEdit } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import { findNode } from "./select.ts";

/** Spaces/tabs between the start of node's line and node.range.start; "" when other text is there. */
export function indentOf(html: string, node: ElementNode): string {
  const lineStart = html.lastIndexOf("\n", node.range.start - 1) + 1;
  const ws = html.slice(lineStart, node.range.start);
  return /^[ \t]*$/.test(ws) ? ws : "";
}

/** The node at path, or ELEMENT_NOT_FOUND. */
export function requireNode(page: PageModel, path: ElementPath): ElementNode {
  const node = findNode(page.body, path);
  if (!node) throw new MasonError("ELEMENT_NOT_FOUND", path);
  return node;
}

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** See PlanEditText in src/contracts/engine.ts. */
export function planEditText(page: PageModel, path: ElementPath, text: string): TextEdit[] {
  const node = requireNode(page, path);
  if ((node.kind !== "text" && node.kind !== "link") || !node.innerRange) throw new MasonError("NOT_TEXT_ELEMENT", path);
  return [{ file: page.file, start: node.innerRange.start, end: node.innerRange.end, text: escapeText(text) }];
}

/** See PlanRemoveElement in src/contracts/engine.ts. */
export function planRemoveElement(page: PageModel, html: string, path: ElementPath): TextEdit[] {
  if (path === "") throw new MasonError("INVALID_INPUT", "The page body cannot be removed.");
  const node = requireNode(page, path);
  let k = node.range.start;
  while (k > 0 && (html[k - 1] === " " || html[k - 1] === "\t")) k -= 1;
  const start = k > 0 && html[k - 1] === "\n" ? k - 1 : node.range.start;
  return [{ file: page.file, start, end: node.range.end, text: "" }];
}
