# T048: Add element actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T048 (build), phase 5 |
| Depends on | T041 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `src/ui/state/element-actions.ts`, `tests/ui/element-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T048`):

1. `npx vitest run tests/ui/element-actions.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store inserts, edits text, removes, moves and wraps elements, selecting the resulting path.

## Context

UI state module. Inserting always returns the tool to Move. The body (path "") is never removed or wrapped.

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

`create-store.ts` registers project, view, event and write slices.

## Steps

1. Create `src/ui/state/element-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createElementActions(ctx: StoreContext): Pick<StudioActions,
  "insertElement" | "editText" | "removeSelected" | "moveElement" | "wrapSelected"> {
  const { client } = ctx;
  return {
    async insertElement(kind, parentPath, index) {
      const page = ctx.get().page;
      ctx.set({ tool: "move" });
      if (page === null) return;
      const result = await ctx.write(() => client.insertElement(page, parentPath, index, kind));
      if (result?.path != null) ctx.actions.select(result.path);
    },
    async editText(path, text) {
      const page = ctx.get().page;
      if (page === null) return;
      await ctx.write(() => client.editText(page, path, text));
    },
    async removeSelected() {
      const { page, selection } = ctx.get();
      if (page === null || selection === null || selection === "") return;
      const result = await ctx.write(() => client.removeElement(page, selection));
      if (result) ctx.set({ selection: null, hover: null, inspect: null });
    },
    async moveElement(path, toIndex) {
      const page = ctx.get().page;
      if (page === null) return;
      const result = await ctx.write(() => client.moveElement(page, path, toIndex));
      if (result?.path != null) ctx.actions.select(result.path);
    },
    async wrapSelected() {
      const { page, selection } = ctx.get();
      if (page === null || selection === null || selection === "") return;
      const result = await ctx.write(() => client.wrapInStack(page, selection));
      if (result?.path != null) ctx.actions.select(result.path);
    },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createElementActions } from "./element-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createElementActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/element-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, WriteResult } from "../../src/contracts/model.ts";

const ok = (path: string | null): WriteResult => ({ files: ["index.html"], revision: 1, effective: true, path, message: "Saved to index.html" });
const tree = { tag: "body" } as ElementNode;

describe("element actions", () => {
  it("inserts, selects the new element and returns to the move tool", async () => {
    const calls: unknown[][] = [];
    const { client } = createFakeClient({ insertElement: async (...a) => { calls.push(a); return ok("1.0.4"); }, pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", tool: "rect" });
    await store.actions.insertElement("rect", "1.0", 4);
    expect(calls).toEqual([["Home", "1.0", 4, "rect"]]);
    expect(store.getState()).toMatchObject({ tool: "move", selection: "1.0.4" });
  });
  it("removes the selection and clears it", async () => {
    const { client } = createFakeClient({ removeElement: async () => ok(null), pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "2" });
    await store.actions.removeSelected();
    expect(store.getState().selection).toBeNull();
  });
  it("never removes or wraps the body", async () => {
    let calls = 0;
    const { client } = createFakeClient({ removeElement: async () => { calls += 1; return ok(null); }, wrapInStack: async () => { calls += 1; return ok(""); } });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "" });
    await store.actions.removeSelected();
    await store.actions.wrapSelected();
    expect(calls).toBe(0);
  });
  it("moves and wraps, selecting the result path", async () => {
    const { client } = createFakeClient({ moveElement: async () => ok("1.2"), wrapInStack: async () => ok("1.2"), editText: async () => ok("1.0"), pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1.0" });
    await store.actions.moveElement("1.0", 2);
    expect(store.getState().selection).toBe("1.2");
    await store.actions.wrapSelected();
    await store.actions.editText("1.2", "Hi");
    expect(store.getState().toast).toMatchObject({ text: "Saved to index.html" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN an element is inserted THE SYSTEM SHALL select the returned path and set the tool to move. (test: "inserts, selects the new element and returns to the move tool")
- THE SYSTEM SHALL never remove or wrap the body. (test: "never removes or wraps the body")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T048`.
The last line must be `GATE PASS T048`. On `GATE FAIL T048 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T048` prints `GATE PASS T048`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T048: Add element actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
