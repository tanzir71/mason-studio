import type { ElementPath } from "../../contracts/model.ts";

/** The element at `path` inside doc.body ("" = body), using Element.children indexes; null when missing. */
export function elementAtPath(doc: Document, path: ElementPath): Element | null {
  let el: Element | null = doc.body;
  if (!el || path === "") return el;
  for (const seg of path.split(".")) {
    el = el.children[Number(seg)] ?? null;
    if (!el) return null;
  }
  return el;
}

/** Path of `el` relative to its document's body; "" for body; null when el is not inside body. */
export function pathOf(el: Element | null): ElementPath | null {
  const body = el?.ownerDocument.body;
  if (!el || !body) return null;
  const segs: number[] = [];
  let cur: Element = el;
  while (cur !== body) {
    const parent: Element | null = cur.parentElement;
    if (!parent) return null;
    segs.unshift(Array.prototype.indexOf.call(parent.children, cur));
    cur = parent;
  }
  return segs.join(".");
}

export interface Box { x: number; y: number; width: number; height: number }
/** Rounded box of `el` in its document's viewport pixels (getBoundingClientRect). */
export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
}
