# T020: Add the view actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T020 (build), phase 3 |
| Depends on | T019 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/state/view-actions.ts`, `tests/ui/view-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T020`):

1. `npx vitest run tests/ui/view-actions.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Selection, hover, scope, active board, tool, tabs, zoom and pan actions work.

## Context

UI state module. Second action slice; registers in `create-store.ts` at the slice anchors (same module).

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

```ts
// src/contracts/model.ts
/** Breakpoint whose width is used to evaluate an edit scope. */
export const SCOPE_BREAKPOINT: Record<Scope, BreakpointId> = { all: "desktop", tablet: "tablet", mobile: "mobile" };
```

## Current state

`src/ui/state/create-store.ts` (T019) contains:

```ts
import { createProjectActions } from "./project-actions.ts";
// @seam:imports
...
  Object.assign(actions, createProjectActions(ctx));
  // @seam:slices
```

`src/ui/state/store-context.ts` exports `StoreContext` with `client`, `get`, `set`, `actions`, `toast`, `run`, `write`, `afterWrite`, `reloadPage`.

## Steps

1. Create `src/ui/state/view-actions.ts` with exactly this content:

```ts
import { SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
/** Clamp to [0.1, 2] and round to 2 decimals. */
export function clampZoom(zoom: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100;
}

export function createViewActions(ctx: StoreContext): Pick<StudioActions,
  "select" | "hover" | "setScope" | "setActiveBoard" | "setTool" | "setLeftTab" | "setRightTab" | "setZoom" | "panBy"> {
  return {
    select(path) {
      ctx.set({ selection: path, inspect: null });
      const page = ctx.get().page;
      if (path === null || page === null) return;
      ctx.client.inspect(page, path)
        .then((inspect) => { if (ctx.get().selection === path && ctx.get().page === page) ctx.set({ inspect }); })
        .catch(() => {});
    },
    hover(path) { if (ctx.get().hover !== path) ctx.set({ hover: path }); },
    setScope(scope) { ctx.set({ scope, activeBoard: SCOPE_BREAKPOINT[scope] }); },
    setActiveBoard(id) { ctx.set({ activeBoard: id, scope: id === "desktop" ? "all" : id }); },
    setTool(tool) { ctx.set({ tool }); },
    setLeftTab(leftTab) { ctx.set({ leftTab }); },
    setRightTab(rightTab) { ctx.set({ rightTab }); },
    setZoom(zoom) { ctx.set({ zoom: clampZoom(zoom) }); },
    panBy(dx, dy) { ctx.set((s) => ({ pan: { x: s.pan.x + dx, y: s.pan.y + dy } })); },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createViewActions } from "./view-actions.ts";` directly above `// @seam:imports`, and `  Object.assign(actions, createViewActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/view-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it, vi } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { clampZoom } from "../../src/ui/state/view-actions.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { InspectResult } from "../../src/contracts/model.ts";

describe("view actions", () => {
  it("select sets the selection and loads inspect", async () => {
    const store = createStudioStore(createFakeClient({ inspect: async (page, path) => ({ page, path } as InspectResult) }).client);
    store.setState({ page: "Home" });
    store.actions.select("1.0");
    expect(store.getState().selection).toBe("1.0");
    await vi.waitFor(() => expect(store.getState().inspect).toEqual({ page: "Home", path: "1.0" }));
    store.actions.select(null);
    expect([store.getState().selection, store.getState().inspect]).toEqual([null, null]);
  });
  it("select keeps working when inspect fails", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ page: "Home" });
    store.actions.select("0");
    await new Promise((r) => setTimeout(r, 0));
    expect([store.getState().selection, store.getState().inspect, store.getState().toast]).toEqual(["0", null, null]);
  });
  it("keeps scope and active board in step", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.setScope("mobile");
    expect([store.getState().scope, store.getState().activeBoard]).toEqual(["mobile", "mobile"]);
    store.actions.setActiveBoard("desktop");
    expect([store.getState().scope, store.getState().activeBoard]).toEqual(["all", "desktop"]);
    store.actions.setActiveBoard("tablet");
    expect(store.getState().scope).toBe("tablet");
  });
  it("clamps and rounds zoom, and pans", () => {
    expect([clampZoom(0.01), clampZoom(5), clampZoom(0.456)]).toEqual([0.1, 2, 0.46]);
    const store = createStudioStore(createFakeClient().client);
    store.actions.setZoom(3);
    store.actions.panBy(10, -5);
    store.actions.panBy(1, 1);
    expect([store.getState().zoom, store.getState().pan]).toEqual([2, { x: 11, y: -4 }]);
  });
  it("sets tool and tabs", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.setTool("hand");
    store.actions.setLeftTab("assets");
    store.actions.setRightTab("checks");
    store.actions.hover("0.1");
    expect(store.getState()).toMatchObject({ tool: "hand", leftTab: "assets", rightTab: "checks", hover: "0.1" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN an element is selected THE SYSTEM SHALL set the selection at once and load inspect for it. (test: "select sets the selection and loads inspect")
- IF inspect fails THEN THE SYSTEM SHALL keep the selection, leave inspect null and show no toast. (test: "select keeps working when inspect fails")
- THE SYSTEM SHALL keep scope and active board in step. (test: "keeps scope and active board in step")
- THE SYSTEM SHALL clamp zoom to 0.1..2 with 2 decimals. (test: "clamps and rounds zoom, and pans")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T020`.
The last line must be `GATE PASS T020`. On `GATE FAIL T020 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T020` prints `GATE PASS T020`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T020: Add the view actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
