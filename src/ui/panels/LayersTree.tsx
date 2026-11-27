import { useState } from "react";
import type { ReactElement } from "react";
import { ChevronDown, ChevronRight, Hash, Image, Link, Rows3, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { NON_VISUAL_TAGS } from "../../contracts/model.ts";
import type { ElementNode, ElementPath, LayerKind } from "../../contracts/model.ts";
import { cx } from "../components/Button.tsx";
import "./panels.css";

const KIND_ICONS: Record<LayerKind, LucideIcon> = { frame: Hash, stack: Rows3, text: Type, image: Image, link: Link };

/** Paths open by default: the body, its children, and every ancestor of the selection. */
export function defaultOpen(selection: ElementPath | null): Set<ElementPath> {
  const open = new Set<ElementPath>([""]);
  if (selection) {
    const segs = selection.split(".");
    for (let i = 1; i < segs.length; i++) open.add(segs.slice(0, i).join("."));
  }
  return open;
}

export function LayersTree() {
  const actions = useActions();
  const tree = useStudio((s) => s.tree);
  const page = useStudio((s) => s.page);
  const selection = useStudio((s) => s.selection);
  const [toggled, setToggled] = useState<Map<ElementPath, boolean>>(new Map());
  if (!tree) return <div data-testid={TEST_IDS.layersTree} />;
  const auto = defaultOpen(selection);
  const isOpen = (path: ElementPath) => toggled.get(path) ?? auto.has(path);
  const flip = (path: ElementPath) => setToggled(new Map(toggled).set(path, !isOpen(path)));

  const rows: ReactElement[] = [];
  const visit = (node: ElementNode, depth: number) => {
    const kids = node.children.filter((c) => !NON_VISUAL_TAGS.includes(c.tag));
    const Icon = KIND_ICONS[node.kind];
    const label = node.path === "" ? (page ?? node.name) : node.name;
    rows.push(
      <div
        key={node.path} role="treeitem" aria-label={label} aria-level={depth + 1} aria-selected={selection === node.path}
        aria-expanded={kids.length ? isOpen(node.path) : undefined} data-path={node.path}
        className={cx("m-row", selection === node.path && "is-selected")} style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => actions.select(node.path)}
        onMouseEnter={() => actions.hover(node.path)}
        onMouseLeave={() => actions.hover(null)}
      >
        {kids.length ? (
          <button type="button" className="m-row__twist" aria-label={isOpen(node.path) ? "Collapse" : "Expand"}
            onClick={(e) => { e.stopPropagation(); flip(node.path); }}>
            {isOpen(node.path) ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : <span className="m-row__spacer" />}
        <Icon className="m-row__icon" aria-hidden="true" />
        <span className="m-row__name">{label}</span>
      </div>,
    );
    if (kids.length && isOpen(node.path)) for (const k of kids) visit(k, depth + 1);
  };
  visit(tree, 0);
  return <div role="tree" aria-label="Layers" data-testid={TEST_IDS.layersTree}>{rows}</div>;
}
