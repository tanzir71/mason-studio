import { CONTAINER_TAGS, INLINE_TAGS, TAG_NAMES, TEXT_TAGS } from "../../contracts/engine.ts";
import type { FriendlyName, LayerKindOf } from "../../contracts/engine.ts";

const IMAGE_TAGS = ["img", "picture", "svg", "video", "canvas"];

/** Camel case, kebab and snake identifiers into sentence case: "hero-copy" → "Hero copy". */
export function humanize(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_\s]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const friendlyName: FriendlyName = (node) => {
  const named = (node.attrs["data-mason-name"] ?? "").trim();
  if (named) return named;
  if (node.tag === "body") return "Page";
  if (node.classes.length > 0) return humanize(node.classes[0]);
  const id = (node.attrs.id ?? "").trim();
  if (id) return humanize(id);
  return TAG_NAMES[node.tag] ?? humanize(node.tag);
};

export const layerKind: LayerKindOf = (node) => {
  const { tag, childTags } = node;
  if (IMAGE_TAGS.includes(tag)) return "image";
  if (tag === "a" || tag === "button") return "link";
  if (tag === "body") return "frame";
  if (TEXT_TAGS.includes(tag) && childTags.every((t) => INLINE_TAGS.includes(t))) return "text";
  if (CONTAINER_TAGS.includes(tag)) return "stack";
  return "frame";
};
