# T029: Build the layers tree

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T029 (build), phase 3 |
| Depends on | T022, T007 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/panels/panels.css`, `src/ui/panels/LayersTree.tsx`, `tests/ui/layers-tree.test.tsx`

**Modify:** none

**Read only:** `src/ui/components/Button.tsx`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T029`):

1. `npx vitest run tests/ui/layers-tree.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`LayersTree` shows the page's element tree with kind icons, friendly names, expand/collapse, selection and hover.

## Context

UI module, panels area. `panels.css` holds the left and right panel styles. Non-visual tags (script, style, link and the rest of NON_VISUAL_TAGS) are hidden. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface ElementNode {
  path: ElementPath;
  tag: string;                       // lowercase
  /** Only these attributes, when present: id, class, src, alt, href, data-mason-name. */
  attrs: Record<string, string>;
  classes: string[];                 // class attribute split on whitespace, empty strings removed
  name: string;                      // friendlyName(...)
  kind: LayerKind;                   // layerKind(...)
  /** Whitespace-collapsed, trimmed text content for kind "text" | "link"; cut to 80 chars + "…". Else null. */
  text: string | null;
  children: ElementNode[];
  range: SourceRange;                // whole element including start and end tag
  innerRange: SourceRange | null;    // from end of start tag to start of end tag; null for void elements
}
export type LayerKind = "frame" | "stack" | "text" | "image" | "link";
/** Tags kept in the tree (paths count them) but hidden from the Layers panel. */
export const NON_VISUAL_TAGS: readonly string[] = ["script", "style", "template", "noscript", "link", "meta", "title", "base"];
```

```tsx
// src/contracts/ui.tsx
/** data-testid values. Board ids: `${TEST_IDS.board}${pageName}-${breakpointId}`. */
export const TEST_IDS = {
  startScreen: "start-screen", topBar: "top-bar", breakpointStrip: "breakpoint-strip", gitChip: "git-chip",
  leftPanel: "left-panel", pagesList: "pages-list", layersTree: "layers-tree", assetsPanel: "assets-panel",
  canvas: "canvas", board: "board-", selection: "overlay-selection", mirror: "overlay-mirror", toolDock: "tool-dock",
  rightPanel: "right-panel", designPanel: "design-panel", scopeControl: "scope-control", inspectPanel: "inspect-panel",
  checksPanel: "checks-panel", codeDrawer: "code-drawer", toast: "toast", reviewCard: "review-card",
  agentPrompt: "agent-prompt", settingsDialog: "settings-dialog",
} as const;
```

## Current state

`src/ui/panels/` does not exist. The test parses the fixture with `parsePage` from `src/engine/html/parse.ts` (tests may import engine code; UI source may not).

## Steps

1. Create `src/ui/panels/panels.css` with exactly this content:

```css
.m-left { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border-subtle); background: var(--bg-panel); }
.m-right { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--border-subtle); background: var(--bg-panel); overflow-x: hidden; overflow-y: auto; }
.m-panel-head { display: flex; align-items: center; justify-content: space-between; height: 40px; padding: 0 var(--space-2); border-bottom: 1px solid var(--border-subtle); flex: none; }
.m-panel-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.m-group { padding: var(--space-2) 0; border-bottom: 1px solid var(--border-subtle); }
.m-group__head { display: flex; align-items: center; justify-content: space-between; height: 28px; padding: 0 var(--space-2) 0 var(--space-3); }
.m-group__title { margin: 0; font: var(--title-13); color: var(--text-strong); }

.m-row {
  display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 var(--space-3);
  border: 0; background: transparent; color: var(--text-default); text-align: left; font: var(--text-12);
}
.m-row:hover { background: var(--bg-hover); }
.m-row.is-selected { background: var(--accent-subtle); color: var(--text-strong); }
.m-row__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-row__meta { font: var(--code-11); color: var(--text-faint); }
.m-row__icon { width: 14px; height: 14px; flex: none; color: var(--text-faint); }
.m-row.is-selected .m-row__icon { color: var(--accent-strong); }
.m-row__twist { display: grid; place-items: center; width: 16px; height: 16px; flex: none; padding: 0; border: 0; background: transparent; color: var(--text-faint); }
.m-row__twist svg { width: 12px; height: 12px; }
.m-row__spacer { width: 16px; flex: none; }
.m-new-page { padding: 4px var(--space-3); }
```

2. Create `src/ui/panels/LayersTree.tsx` with exactly this content:

```tsx
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
```

3. Create `tests/ui/layers-tree.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { LayersTree, defaultOpen } from "../../src/ui/panels/LayersTree.tsx";
import { parsePage } from "../../src/engine/html/parse.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;
const renderTree = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", page: "Home", tree, ...state });
  render(<StudioContext.Provider value={store}><LayersTree /></StudioContext.Provider>);
  return store;
};
const names = () => within(screen.getByTestId("layers-tree")).getAllByRole("treeitem").map((r) => r.textContent);

describe("LayersTree", () => {
  it("opens the body and the ancestors of the selection", () => {
    expect([...defaultOpen("1.0.0.1")]).toEqual(["", "1", "1.0", "1.0.0"]);
    expect([...defaultOpen(null)]).toEqual([""]);
  });
  it("lists the page and its top-level layers", () => {
    renderTree();
    expect(names()).toEqual(["Home", "Header", "Main", "Footer"]);
  });
  it("expands down to the selection and marks it", () => {
    renderTree({ selection: "1.0.0.1" });
    expect(names()).toEqual(["Home", "Header", "Main", "Hero", "Hero copy", "Eyebrow", "Headline", "Lede", "Order button", "Hero photo", "This week", "Footer"]);
    expect(screen.getByRole("treeitem", { name: /Headline/ })).toHaveAttribute("aria-selected", "true");
  });
  it("selects, hovers and toggles rows", async () => {
    const store = renderTree();
    await userEvent.click(screen.getByRole("treeitem", { name: /Footer/ }));
    const header = screen.getByRole("treeitem", { name: /Header/ });
    await userEvent.click(within(header).getByRole("button", { name: "Expand" }));
    expect(names()).toEqual(["Home", "Header", "Logo", "Nav", "Main", "Footer"]);
    expect(store.calls.filter((c) => c.name === "select")).toEqual([{ name: "select", args: ["2"] }]);
    expect(store.calls.some((c) => c.name === "hover" && c.args[0] === "2")).toBe(true);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL open the body and every ancestor of the selection by default. (test: "expands down to the selection and marks it")
- WHEN a row is clicked or hovered THE SYSTEM SHALL select or hover its path; the chevron toggles it. (test: "selects, hovers and toggles rows")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T029`.
The last line must be `GATE PASS T029`. On `GATE FAIL T029 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/app, components, canvas, panels, styles` and uses only the contracts (fakes only in tests).
- Do not change any class name, test id, aria-label, role or visible text from the code given.
- Do not use italics, inline color literals or new CSS variables.
- Do not import from `src/engine/` or `src/server/`; the UI talks to the studio only through the store.

## Done when

- `verify.ps1 -Card T029` prints `GATE PASS T029`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T029: Build the layers tree
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
