import { MasonError } from "../../contracts/errors.ts";
import type { ElementSelector, FindNode, NextClassName } from "../../contracts/engine.ts";
import type { ElementNode } from "../../contracts/model.ts";

export const findNode: FindNode = (body, path) => {
  if (path === "") return body;
  let node: ElementNode | null = body;
  for (const segment of path.split(".")) {
    node = node.children[Number(segment)] ?? null;
    if (!node) return null;
  }
  return node;
};

export const elementSelector: ElementSelector = (body, path) => {
  const node = findNode(body, path);
  if (!node) throw new MasonError("ELEMENT_NOT_FOUND", path);
  const id = node.attrs.id;
  if (id) return `#${id}`;
  if (node.classes.length > 0) return "." + node.classes.join(".");

  const segments = path === "" ? [] : path.split(".");
  let ancestorPath = segments.slice(0, -1);
  while (ancestorPath.length > 0) {
    const ancestor = findNode(body, ancestorPath.join("."));
    if (ancestor) {
      const ancestorId = ancestor.attrs.id;
      if (ancestorId) return `#${ancestorId} ${node.tag}`;
      if (ancestor.classes.length > 0) return `.${ancestor.classes[0]} ${node.tag}`;
    }
    ancestorPath = ancestorPath.slice(0, -1);
  }

  const tags: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const step = findNode(body, segments.slice(0, i + 1).join("."));
    if (step) tags.push(step.tag);
  }
  return "body > " + tags.join(" > ");
};

export const nextClassName: NextClassName = (body, prefix) => {
  const used = new Set<string>();
  const walk = (node: ElementNode): void => {
    for (const name of node.classes) used.add(name);
    for (const child of node.children) walk(child);
  };
  walk(body);
  let n = 1;
  while (used.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};
