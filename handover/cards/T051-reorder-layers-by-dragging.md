# T051: Reorder layers by dragging

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T051 (build), phase 5 |
| Depends on | T050, T047, T044 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `tests/e2e/elements.spec.ts`, `tests/ui/layers-drag.test.tsx`

**Modify:** `src/ui/panels/LayersTree.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T051`):

1. `npx vitest run tests/ui/layers-drag.test.tsx` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx vitest run tests/ui/layers-tree.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test elements.spec.ts --project=chromium` -> exit 0, output contains `3 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Dragging a layer onto a sibling moves it to that sibling's index; the phase 5 smoke test inserts, edits text and deletes through the browser.

## Context

UI module, panels area. Only siblings accept a drop; the body row is not draggable. This card also adds the phase 5 Playwright smoke spec; each of its tests undoes its change so the fixture stays clean for later specs. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
/**
 * Store actions. Every async action catches errors: a MasonError (or any Error) becomes
 * toast { tone: "error", text: error.message, undo: false } and the promise resolves (never rejects).
 * After every successful write (applyStyle ... redo, saveCode, acceptProposal, exportTokens):
 * revision = result.revision, toast { tone: "success", text: result.message, undo: true }, then tree
 * (pageTree) and inspect (when selection is set) are reloaded.
 */
export interface StudioActions {
  init(): Promise<void>;                      // recent, templates, settings; currentProject → openProject flow, NO_PROJECT → stay on start
  openProject(root: string): Promise<void>;   // screen "canvas", page = first page, tree, git, tokens, proposals loaded
  createProject(root: string, template: TemplateId): Promise<void>;
  closeProject(): void;                       // screen "start", project/page/tree/selection cleared
  selectPage(name: string): Promise<void>;    // loads tree, clears selection and inspect
  createPage(name: string): Promise<void>;
  select(path: ElementPath | null): void;     // sets selection, then loads inspect (null clears inspect)
  hover(path: ElementPath | null): void;
  setScope(scope: Scope): void;               // also activeBoard = SCOPE_BREAKPOINT[scope]
  setActiveBoard(id: BreakpointId): void;     // also scope: desktop → "all", tablet → "tablet", mobile → "mobile"
  setTool(tool: ToolId): void;
  setLeftTab(tab: LeftTab): void;
  setRightTab(tab: RightTab): void;
  setZoom(zoom: number): void;                // clamped to 0.1 .. 2
  panBy(dx: number, dy: number): void;
  applyStyle(prop: InspectProp, value: string): Promise<void>;   // page + selection + scope
  resetStyle(prop: InspectProp): Promise<void>;
  insertElement(kind: InsertKind, parentPath: ElementPath, index: number): Promise<void>; // selects result.path
  editText(path: ElementPath, text: string): Promise<void>;
  removeSelected(): Promise<void>;            // selection becomes null
  moveElement(path: ElementPath, toIndex: number): Promise<void>; // selects result.path
  wrapSelected(): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  loadTokens(): Promise<void>;
  importTokens(format: TokenFormat, json: string): Promise<void>;
  exportTokens(): Promise<void>;
  runChecks(): Promise<void>;
  setContrast(findings: CheckFinding[]): void;
  openCode(file: string, line: number | null): Promise<void>;     // readFile → code { open: true, text, dirty: false }
  editCode(text: string): void;               // code.text = text, dirty = true
  saveCode(): Promise<void>;                  // writeFile, dirty = false
  closeCode(): void;
  refreshGit(): Promise<void>;
  commit(message: string): Promise<void>;
  openAgentPrompt(): void;
  closeAgentPrompt(): void;
  askAgent(prompt: string): Promise<void>;    // askAgent(page, selection, prompt, scope) → proposal added, prompt closed
  loadProposals(): Promise<void>;
  acceptProposal(id: string, includeBlocked: boolean): Promise<void>;
  rejectProposal(id: string): Promise<void>;
  openSettings(): void;
  closeSettings(): void;
  saveSettings(settings: Settings): Promise<void>;
  /** written / external-change → revision + 1 (written: revision = event.revision), reload tree and inspect;
   *  proposal → insert or replace by id at the front of proposals; project-opened → ignored. */
  handleEvent(event: MasonEvent): void;
  showToast(tone: Toast["tone"], text: string, undo: boolean): void; // id = previous id + 1
  dismissToast(): void;
}
```

## Current state

`src/ui/panels/LayersTree.tsx` (T029) exports `defaultOpen` and `LayersTree`.

## Steps

1. Replace the whole content of `src/ui/panels/LayersTree.tsx` with exactly:

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

/** Parent path of a non-body path. */
export function parentPath(path: ElementPath): ElementPath {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(0, dot);
}

/** The sibling index a dragged row moves to when dropped on `target`, or null when they do not share a parent. */
export function dropIndex(dragged: ElementPath, target: ElementPath): number | null {
  if (dragged === "" || target === "" || dragged === target || parentPath(dragged) !== parentPath(target)) return null;
  return Number(target.slice(target.lastIndexOf(".") + 1));
}

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
  const [dragged, setDragged] = useState<ElementPath | null>(null);
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
        draggable={node.path !== ""}
        onDragStart={(e) => { setDragged(node.path); e.dataTransfer?.setData("text/plain", node.path); }}
        onDragOver={(e) => { if (dragged !== null && dropIndex(dragged, node.path) !== null) e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const to = dragged === null ? null : dropIndex(dragged, node.path);
          if (dragged !== null && to !== null) void actions.moveElement(dragged, to);
          setDragged(null);
        }}
        onDragEnd={() => setDragged(null)}
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

2. Create `tests/e2e/elements.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const html = () => readFileSync("tests/.tmp/northfield/index.html", "utf8");

/** Page coordinates of the center of `selector` inside the Home desktop board. */
async function pointOn(page: Page, selector: string) {
  const board = page.getByTestId("board-Home-desktop");
  const hit = await board.locator(".m-board__hit").boundingBox();
  const r = await board.frameLocator("iframe").locator(selector).evaluate((el) => el.getBoundingClientRect().toJSON());
  const zoom = hit!.width / 1280;
  return { x: hit!.x + (r.x + r.width / 2) * zoom, y: hit!.y + (r.y + r.height / 2) * zoom };
}

test("inserts a rectangle into the hero copy with the rectangle tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator(".hero-copy")).toBeVisible();
  await page.keyboard.press("r");
  const p = await pointOn(page, ".hero-copy");
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html, styles.css");
  expect(html()).toContain('<div class="rect-1"></div>');
  expect(readFileSync("tests/.tmp/northfield/styles.css", "utf8")).toContain(".rect-1 {");
  await expect(page.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("layers-tree").getByRole("treeitem", { name: "Rect 1" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).not.toContain("rect-1");
});

test("edits the headline text in place", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1")).toBeVisible();
  const p = await pointOn(page, "h1");
  await page.mouse.dblclick(p.x, p.y);
  const editor = page.getByLabel("Edit text");
  await expect(editor).toHaveValue("Small-batch coffee, roasted down the street.");
  await editor.fill("Fresh beans, every week.");
  await editor.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html");
  expect(html()).toContain('<h1 class="headline">Fresh beans, every week.</h1>');
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).toContain("Small-batch coffee, roasted down the street.");
});

test("deletes the footer and undoes it with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("layers-tree").getByRole("treeitem", { name: "Footer" }).click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("toast")).toContainText("Saved to index.html");
  expect(html()).not.toContain("<footer");
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(html()).toContain("<footer");
});
```

3. Create `tests/ui/layers-drag.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { LayersTree, dropIndex, parentPath } from "../../src/ui/panels/LayersTree.tsx";
import { parsePage } from "../../src/engine/html/parse.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;

describe("layer reordering", () => {
  it("computes parents and drop indexes for siblings only", () => {
    expect([parentPath("1.0.2"), parentPath("2")]).toEqual(["1.0", ""]);
    expect(dropIndex("0", "2")).toBe(2);
    expect(dropIndex("1.0.0.3", "1.0.0.0")).toBe(0);
    expect(dropIndex("1.0", "2")).toBeNull();
    expect(dropIndex("", "1")).toBeNull();
  });
  it("moves a dragged row to the drop target's index", () => {
    const store = createFakeStore({ screen: "canvas", page: "Home", tree });
    render(<StudioContext.Provider value={store}><LayersTree /></StudioContext.Provider>);
    const footer = screen.getByRole("treeitem", { name: "Footer" });
    const header = screen.getByRole("treeitem", { name: "Header" });
    expect(footer).toHaveAttribute("draggable", "true");
    expect(screen.getByRole("treeitem", { name: "Home" })).toHaveAttribute("draggable", "false");
    fireEvent.dragStart(footer);
    fireEvent.dragOver(header);
    fireEvent.drop(header);
    expect(store.calls).toEqual([{ name: "moveElement", args: ["2", 0] }]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL compute drop indexes only between siblings. (test: "computes parents and drop indexes for siblings only")
- WHEN a row is dropped on a sibling THE SYSTEM SHALL call moveElement with that sibling's index. (test: "moves a dragged row to the drop target's index")
- WHEN the rectangle tool clicks the hero copy, a headline is double-clicked and edited, or the footer is deleted THE SYSTEM SHALL write index.html, and Undo restores it (verify: Playwright elements.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T051`.
The last line must be `GATE PASS T051`. On `GATE FAIL T051 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T051` prints `GATE PASS T051`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T051: Reorder layers by dragging
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
