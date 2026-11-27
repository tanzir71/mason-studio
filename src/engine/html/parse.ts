import { parse } from "parse5";
import { adapter } from "parse5-htmlparser2-tree-adapter";
import { is } from "css-select";
import type { ChildNode, Document, Element } from "domhandler";
import type { ElementMatcher, ElementNode, ElementPath } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import { friendlyName, layerKind } from "./names.ts";

const KEEP_ATTRS = ["id", "class", "src", "alt", "href", "data-mason-name"];
const isElement = (n: ChildNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";

interface SourceLocation {
  startOffset: number;
  endOffset: number;
  startTag?: { endOffset: number };
  endTag?: { startOffset: number };
}

function textOf(node: ChildNode): string {
  let out = "";
  const walk = (n: ChildNode): void => {
    if (n.type === "text") {
      out += n.data;
      return;
    }
    if ("children" in n) {
      for (const child of n.children) walk(child);
    }
  };
  walk(node);
  return out;
}

export function parsePage(file: string, text: string): PageModel {
  const doc = parse(text, { treeAdapter: adapter, sourceCodeLocationInfo: true }) as unknown as Document;
  const byPath = new Map<ElementPath, Element>();

  const htmlEl = doc.children.filter(isElement).find((el) => el.name.toLowerCase() === "html");
  const htmlChildren = htmlEl ? htmlEl.children.filter(isElement) : [];
  const head = htmlChildren.find((el) => el.name.toLowerCase() === "head");
  const bodyEl = htmlChildren.find((el) => el.name.toLowerCase() === "body");

  const titleEl = head?.children.filter(isElement).find((el) => el.name.toLowerCase() === "title");
  const titleText = titleEl ? textOf(titleEl).trim() : "";
  const title = titleText || file.replace(/\.html$/i, "");

  const stylesheets: string[] = [];
  if (head) {
    for (const el of head.children.filter(isElement)) {
      if (el.name.toLowerCase() !== "link") continue;
      const rel = (el.attribs.rel ?? "").split(/\s+/);
      if (!rel.includes("stylesheet")) continue;
      const href = el.attribs.href;
      if (href === undefined) continue;
      if (href.includes("://") || href.startsWith("/")) continue;
      let local = href.split(/[?#]/)[0];
      if (local.startsWith("./")) local = local.slice(2);
      stylesheets.push(local);
    }
  }

  const build = (el: Element, path: ElementPath): ElementNode => {
    byPath.set(path, el);
    const childElements = el.children.filter(isElement);
    const children = childElements.map((child, i) => build(child, path === "" ? `${i}` : `${path}.${i}`));
    const attrs: Record<string, string> = {};
    for (const key of KEEP_ATTRS) {
      const value = el.attribs[key];
      if (value !== undefined) attrs[key] = value;
    }
    const classes = (el.attribs.class ?? "").split(/\s+/).filter(Boolean);
    const tag = el.name.toLowerCase();
    const kind = layerKind({ tag, childTags: childElements.map((c) => c.name.toLowerCase()) });
    const name = friendlyName({ tag, attrs, classes });
    let nodeText: string | null = null;
    if (kind === "text" || kind === "link") {
      const collapsed = textOf(el).replace(/\s+/g, " ").trim();
      nodeText = collapsed.length > 80 ? collapsed.slice(0, 80) + "…" : collapsed;
    }
    const loc = (el as unknown as { sourceCodeLocation?: SourceLocation }).sourceCodeLocation;
    let range: { start: number; end: number };
    let innerRange: { start: number; end: number } | null;
    if (loc) {
      range = { start: loc.startOffset, end: loc.endOffset };
      innerRange = loc.endTag ? { start: loc.startTag!.endOffset, end: loc.endTag.startOffset } : null;
    } else {
      range = { start: 0, end: text.length };
      innerRange = null;
    }
    return { path, tag, attrs, classes, name, kind, text: nodeText, children, range, innerRange };
  };

  const body = build(bodyEl as Element, "");
  return {
    file, title, stylesheets, body,
    matcher(path: ElementPath): ElementMatcher | null {
      const el = byPath.get(path);
      if (!el) return null;
      return { matches: (selector: string) => { try { return is(el, selector); } catch { return false; } } };
    },
  };
}
