import { SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { BreakpointId, ElementNode, ElementPath, InspectProp, InspectResult, LayerKind, Scope } from "../../contracts/model.ts";

export type DesignSectionId = "layout" | "text" | "fill" | "stroke" | "effects";
export interface DesignField { prop: InspectProp; prefix: string; label: string; section: DesignSectionId; wide?: boolean }

/** Every field of the Design panel, in display order. `label` is the input's accessible name. */
export const DESIGN_FIELDS: readonly DesignField[] = [
  { prop: "display", prefix: "Display", label: "Display", section: "layout" },
  { prop: "flex-direction", prefix: "Dir", label: "Direction", section: "layout" },
  { prop: "width", prefix: "W", label: "Width", section: "layout" },
  { prop: "height", prefix: "H", label: "Height", section: "layout" },
  { prop: "max-width", prefix: "Max W", label: "Max width", section: "layout" },
  { prop: "gap", prefix: "Gap", label: "Gap", section: "layout" },
  { prop: "padding", prefix: "Pad", label: "Padding", section: "layout" },
  { prop: "margin", prefix: "Margin", label: "Margin", section: "layout" },
  { prop: "justify-content", prefix: "Justify", label: "Justify", section: "layout" },
  { prop: "align-items", prefix: "Items", label: "Align items", section: "layout" },
  { prop: "grid-template-columns", prefix: "Columns", label: "Columns", section: "layout", wide: true },
  { prop: "font-family", prefix: "Font", label: "Font", section: "text", wide: true },
  { prop: "font-weight", prefix: "Weight", label: "Weight", section: "text" },
  { prop: "font-size", prefix: "Size", label: "Font size", section: "text" },
  { prop: "line-height", prefix: "Line", label: "Line height", section: "text" },
  { prop: "letter-spacing", prefix: "Letter", label: "Letter spacing", section: "text" },
  { prop: "text-align", prefix: "Align", label: "Text align", section: "text" },
  { prop: "color", prefix: "Color", label: "Text color", section: "text", wide: true },
  { prop: "background-color", prefix: "Fill", label: "Fill", section: "fill", wide: true },
  { prop: "border", prefix: "Stroke", label: "Stroke", section: "stroke", wide: true },
  { prop: "border-radius", prefix: "Radius", label: "Radius", section: "stroke", wide: true },
  { prop: "opacity", prefix: "Opacity", label: "Opacity", section: "effects" },
  { prop: "box-shadow", prefix: "Shadow", label: "Shadow", section: "effects", wide: true },
];

export const SECTION_TITLES: Record<DesignSectionId, string> = { layout: "Layout", text: "Text", fill: "Fill", stroke: "Stroke", effects: "Effects" };

/** Sections shown for a layer kind: text and link layers get the Text section, others do not. */
export function sectionsFor(kind: LayerKind): DesignSectionId[] {
  return kind === "text" || kind === "link" ? ["layout", "text", "fill", "stroke", "effects"] : ["layout", "fill", "stroke", "effects"];
}

export const SCOPE_LABELS: Record<Scope, string> = { all: "All sizes", tablet: "≤ 768", mobile: "≤ 375" };
export const SCOPE_NOTES: Record<Scope, string> = {
  all: "Edits the base rule. Every size inherits it.",
  tablet: "Tablet and smaller. Desktop keeps its own values.",
  mobile: "Phones only. Tablet and desktop keep their own values.",
};

export interface FieldView { value: string; override: boolean; desktop: string | null }
/** Value shown for a field at the scope's breakpoint, whether it is an override there, and the desktop value. */
export function fieldView(inspect: InspectResult, prop: InspectProp, scope: Scope): FieldView {
  const info = inspect.props[prop];
  const bp: BreakpointId = SCOPE_BREAKPOINT[scope];
  return { value: info.values[bp] ?? "", override: info.overriddenAt.includes(bp), desktop: info.values.desktop };
}

/** The node at `path` in a page tree ("" = body), or null. */
export function nodeAt(tree: ElementNode, path: ElementPath): ElementNode | null {
  if (path === "") return tree;
  let n: ElementNode | undefined = tree;
  for (const seg of path.split(".")) { n = n?.children[Number(seg)]; if (!n) return null; }
  return n ?? null;
}
