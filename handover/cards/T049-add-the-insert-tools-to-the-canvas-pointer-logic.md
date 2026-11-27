# T049: Add the insert tools to the canvas pointer logic

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T049 (build), phase 5 |
| Depends on | T027, T042 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `tests/ui/insert-tools.test.ts`

**Modify:** `src/ui/canvas/tools.ts`

**Read only:** `src/ui/panels/design-fields.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T049`):

1. `npx vitest run tests/ui/insert-tools.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx vitest run tests/ui/canvas.test.tsx` -> exit 0, output contains `Tests  6 passed (6)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

With Frame, Rectangle, Ellipse, Text or Image active, a click on the open page inserts that element; `editablePath` decides when a double click edits text.

## Context

UI module, canvas area. `insertTarget` appends inside a frame or stack, otherwise inserts right after the clicked element. `nodeAt` comes from `../panels/design-fields.ts` (T042).

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export interface StudioState {
  screen: "start" | "canvas";
  project: ProjectInfo | null;
  recent: RecentProject[];
  templates: TemplateInfo[];
  page: string | null;              // PageInfo.name of the open page
  tree: ElementNode | null;         // body of the open page
  selection: ElementPath | null;
  hover: ElementPath | null;
  scope: Scope;
  activeBoard: BreakpointId;
  tool: ToolId;
  leftTab: LeftTab;
  rightTab: RightTab;
  zoom: number;                     // 0.1 .. 2
  pan: { x: number; y: number };
  inspect: InspectResult | null;    // for `selection`
  tokens: TokenSet | null;
  checks: CheckReport | null;
  contrast: CheckFinding[];         // computed in the browser from board iframes
  proposals: Proposal[];
  code: CodeState;
  git: GitStatus | null;
  settings: Settings | null;
  settingsOpen: boolean;
  agentPrompt: { open: boolean; busy: boolean };
  toast: Toast | null;
  revision: number;                 // boards reload when it changes
  busy: boolean;                    // true while a write is in flight
}
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

```ts
// src/contracts/model.ts
export type InsertKind = "frame" | "rect" | "ellipse" | "text" | "image";
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
```

## Current state

`src/ui/canvas/tools.ts` (T027) exports `ROW_WIDTH`, `fitZoom`, `pathAtPoint`, `BoardPointer`, `boardPointerDown`, `boardPointerMove`.

## Steps

1. Replace the whole content of `src/ui/canvas/tools.ts` with exactly:

```ts
import type { BreakpointId, ElementNode, ElementPath, InsertKind } from "../../contracts/model.ts";
import type { StudioActions, StudioState } from "../../contracts/ui.tsx";
import { pathOf } from "./dom-paths.ts";
import { nodeAt } from "../panels/design-fields.ts";

export const INSERT_TOOLS: readonly InsertKind[] = ["frame", "rect", "ellipse", "text", "image"];

/**
 * Where an insert tool click puts the new element: inside a frame/stack (appended last; the body when path is null),
 * else right after the clicked element in its parent.
 */
export function insertTarget(tree: ElementNode, path: ElementPath | null): { parentPath: ElementPath; index: number } {
  const node = path === null ? tree : nodeAt(tree, path) ?? tree;
  if (node.path === "" || node.kind === "frame" || node.kind === "stack") return { parentPath: node.path, index: node.children.length };
  const dot = node.path.lastIndexOf(".");
  return { parentPath: dot === -1 ? "" : node.path.slice(0, dot), index: Number(node.path.slice(dot + 1)) + 1 };
}

/** Width of one page row at zoom 1: the three boards plus two 48px gaps plus 48px padding on both sides. */
export const ROW_WIDTH = 1280 + 768 + 375 + 2 * 48 + 2 * 48;
/** Zoom that fits a page row into `width` pixels, clamped to [0.1, 2], 2 decimals. */
export function fitZoom(width: number): number {
  return Math.round(Math.min(2, Math.max(0.1, width / ROW_WIDTH)) * 100) / 100;
}

/** Element path under a pointer event on a board's hit layer, or null. */
export function pathAtPoint(frame: HTMLIFrameElement | null, hit: HTMLElement, clientX: number, clientY: number, zoom: number): ElementPath | null {
  const doc = frame?.contentDocument;
  if (!doc) return null;
  const r = hit.getBoundingClientRect();
  const el = doc.elementFromPoint((clientX - r.left) / zoom, (clientY - r.top) / zoom);
  return el ? pathOf(el) : null;
}

export interface BoardPointer { page: string; board: BreakpointId; path: ElementPath | null }

/**
 * Pointer down on a board. Another page → selectPage. Move tool → activate the board and select the path.
 * Insert tools → insertElement(tool, insertTarget(tree, path)).
 */
export function boardPointerDown(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page !== p.page) { void actions.selectPage(p.page); return; }
  if (state.tool === "move") {
    if (state.activeBoard !== p.board) actions.setActiveBoard(p.board);
    actions.select(p.path);
    return;
  }
  const kind = INSERT_TOOLS.find((k) => k === state.tool);
  if (kind && state.tree) {
    const target = insertTarget(state.tree, p.path);
    void actions.insertElement(kind, target.parentPath, target.index);
  }
}

/** Double click on a board with the move tool: the text/link path to edit, or null. */
export function editablePath(state: StudioState, p: BoardPointer): ElementPath | null {
  if (state.page !== p.page || state.tool !== "move" || p.path === null || !state.tree) return null;
  const node = nodeAt(state.tree, p.path);
  return node && (node.kind === "text" || node.kind === "link") ? node.path : null;
}

/** Pointer move on a board: hover follows the pointer with the move tool on the open page. */
export function boardPointerMove(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page === p.page && state.tool === "move") actions.hover(p.path);
}
```

2. Create `tests/ui/insert-tools.test.ts` with exactly this content:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardPointerDown, editablePath, insertTarget } from "../../src/ui/canvas/tools.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;

describe("insert tools", () => {
  it("inserts inside containers and after other elements", () => {
    expect(insertTarget(tree, "1.0.0")).toEqual({ parentPath: "1.0.0", index: 4 });
    expect(insertTarget(tree, "1.0.0.1")).toEqual({ parentPath: "1.0.0", index: 2 });
    expect(insertTarget(tree, null)).toEqual({ parentPath: "", index: 3 });
    expect(insertTarget(tree, "1.0.1")).toEqual({ parentPath: "1.0", index: 2 });
  });
  it("runs insertElement for insert tools on the open page", () => {
    const store = createFakeStore({ page: "Home", tool: "ellipse", tree });
    boardPointerDown(store.getState(), store.actions, { page: "Home", board: "desktop", path: "1.0.0.1" });
    expect(store.calls).toEqual([{ name: "insertElement", args: ["ellipse", "1.0.0", 2] }]);
  });
  it("edits only text and link elements with the move tool", () => {
    const state = createFakeStore({ page: "Home", tool: "move", tree }).getState();
    expect(editablePath(state, { page: "Home", board: "desktop", path: "1.0.0.1" })).toBe("1.0.0.1");
    expect(editablePath(state, { page: "Home", board: "desktop", path: "1.0" })).toBeNull();
    expect(editablePath({ ...state, tool: "rect" }, { page: "Home", board: "desktop", path: "1.0.0.1" })).toBeNull();
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL insert inside containers and after other elements. (test: "inserts inside containers and after other elements")
- WHEN an insert tool is active and the open page is clicked THE SYSTEM SHALL call insertElement. (test: "runs insertElement for insert tools on the open page")
- THE SYSTEM SHALL allow text editing only for text and link elements with the move tool. (test: "edits only text and link elements with the move tool")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T049`.
The last line must be `GATE PASS T049`. On `GATE FAIL T049 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T049` prints `GATE PASS T049`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T049: Add the insert tools to the canvas pointer logic
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
