# T041: Add style, reset, undo and redo actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T041 (build), phase 4 |
| Depends on | T021 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19, R21 |

**Create:** `src/ui/state/write-actions.ts`, `tests/ui/write-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T041`):

1. `npx vitest run tests/ui/write-actions.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store applies and resets styles for the selection at the current scope, and undoes and redoes, with the shared write helper.

## Context

UI state module. Uses `ctx.write` from `store-context.ts`, which already sets the revision, shows the success toast with Undo and reloads tree and inspect.

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

`src/ui/state/store-context.ts` exports `StoreContext` (with `write(fn)` returning the WriteResult or null). `create-store.ts` registers project, view and event slices.

## Steps

1. Create `src/ui/state/write-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export const NOT_EFFECTIVE_TEXT = "Saved, but another rule still wins at this size.";

export function createWriteActions(ctx: StoreContext): Pick<StudioActions, "applyStyle" | "resetStyle" | "undo" | "redo"> {
  const { client } = ctx;
  return {
    async applyStyle(prop, value) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      const result = await ctx.write(() => client.applyStyle({ page, path: selection, prop, value, scope }));
      if (result && !result.effective) ctx.toast("info", NOT_EFFECTIVE_TEXT, true);
    },
    async resetStyle(prop) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      await ctx.write(() => client.resetStyle(page, selection, prop, scope));
    },
    async undo() { await ctx.write(() => client.undo()); },
    async redo() { await ctx.write(() => client.redo()); },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createWriteActions } from "./write-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createWriteActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/write-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { NOT_EFFECTIVE_TEXT } from "../../src/ui/state/write-actions.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, StyleChange, WriteResult } from "../../src/contracts/model.ts";

const ok = (revision: number, message = "Saved to styles.css", effective = true): WriteResult => ({ files: ["styles.css"], revision, effective, path: null, message });
const tree = { tag: "body" } as ElementNode;

describe("write actions", () => {
  it("applies a style to the selection at the current scope", async () => {
    const seen: StyleChange[] = [];
    const { client } = createFakeClient({ applyStyle: async (c) => { seen.push(c); return ok(1); }, pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1.0.0.1", scope: "tablet" });
    await store.actions.applyStyle("font-size", "30px");
    expect(seen).toEqual([{ page: "Home", path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" }]);
    expect(store.getState()).toMatchObject({ revision: 1, toast: { tone: "success", text: "Saved to styles.css", undo: true } });
  });
  it("warns when the saved value does not win", async () => {
    const store = createStudioStore(createFakeClient({ applyStyle: async () => ok(2, "Saved to styles.css", false), pageTree: async () => tree }).client);
    store.setState({ page: "Home", selection: "0" });
    await store.actions.applyStyle("color", "red");
    expect(store.getState().toast).toMatchObject({ tone: "info", text: NOT_EFFECTIVE_TEXT });
  });
  it("does nothing without a selection", async () => {
    let calls = 0;
    const store = createStudioStore(createFakeClient({ applyStyle: async () => { calls += 1; return ok(1); } }).client);
    store.setState({ page: "Home" });
    await store.actions.applyStyle("color", "red");
    expect(calls).toBe(0);
  });
  it("resets, undoes and redoes through the client", async () => {
    const calls: unknown[][] = [];
    const { client } = createFakeClient({
      resetStyle: async (...a) => { calls.push(["reset", ...a]); return ok(3); },
      undo: async () => { calls.push(["undo"]); return ok(4, "Undid: Saved to styles.css"); },
      redo: async () => { calls.push(["redo"]); return ok(5, "Redid: Saved to styles.css"); },
      pageTree: async () => tree,
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1", scope: "mobile" });
    await store.actions.resetStyle("font-size");
    await store.actions.undo();
    await store.actions.redo();
    expect(calls).toEqual([["reset", "Home", "1", "font-size", "mobile"], ["undo"], ["redo"]]);
    expect(store.getState()).toMatchObject({ revision: 5, toast: { text: "Redid: Saved to styles.css" } });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN applyStyle runs with a selection THE SYSTEM SHALL send page, path, prop, value and scope. (test: "applies a style to the selection at the current scope")
- IF the result is not effective THEN THE SYSTEM SHALL show the info toast "Saved, but another rule still wins at this size.". (test: "warns when the saved value does not win")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T041`.
The last line must be `GATE PASS T041`. On `GATE FAIL T041 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T041` prints `GATE PASS T041`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T041: Add style, reset, undo and redo actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
