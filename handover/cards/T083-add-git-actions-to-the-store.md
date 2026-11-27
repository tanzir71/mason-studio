# T083: Add Git actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T083 (build), phase 10 |
| Depends on | T041 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R34 |

**Create:** `src/ui/state/git-actions.ts`, `tests/ui/git-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`, `src/ui/state/store-context.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T083`):

1. `npx vitest run tests/ui/git-actions.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx vitest run tests/ui/store-context.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store commits, refreshes Git status quietly, and refreshes it every time the page reloads after a write or an outside change.

## Context

UI state module. refreshGit is a background refresh: on failure it keeps the last status and shows no toast (unlike other actions), so a folder without Git never produces error toasts.

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
export interface GitStatus { isRepo: boolean; branch: string | null; changes: number; files: string[] }
```

## Current state

`src/ui/state/store-context.ts` (T019) contains:

```ts
    async reloadPage() {
      const { page } = store.getState();
```

## Steps

1. Create `src/ui/state/git-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createGitActions(ctx: StoreContext): Pick<StudioActions, "refreshGit" | "commit"> {
  return {
    /** Background refresh: on failure the last status stays and no toast is shown. */
    async refreshGit() {
      try { ctx.set({ git: await ctx.client.gitStatus() }); } catch { /* keep the last status */ }
    },
    commit: (message) => ctx.run(async () => {
      const git = await ctx.client.commit(message);
      ctx.set({ git });
      ctx.toast("success", "Committed", false);
    }),
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createGitActions } from "./git-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createGitActions(ctx));` directly above `  // @seam:slices`.

3. In `src/ui/state/store-context.ts` replace the lines shown under Current state with:

```ts
    async reloadPage() {
      void store.actions.refreshGit();
      const { page } = store.getState();
```

and change the doc comment of `reloadPage` in the `StoreContext` interface to `/** Starts refreshGit(); with a page open: tree = pageTree(page); with a selection: inspect = inspect(page, selection), or null when that fails. */`.

4. Create `tests/ui/git-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createStoreContext } from "../../src/ui/state/store-context.ts";
import { createFakeClient, createFakeStore } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, GitStatus } from "../../src/contracts/model.ts";

const status: GitStatus = { isRepo: true, branch: "main", changes: 2, files: ["a.css", "b.html"] };

describe("git actions", () => {
  it("refreshes quietly and keeps the last status on failure", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ git: status });
    await store.actions.refreshGit();
    expect([store.getState().git, store.getState().toast]).toEqual([status, null]);
  });
  it("commits and stores the new status", async () => {
    const messages: string[] = [];
    const store = createStudioStore(createFakeClient({ commit: async (m) => { messages.push(m); return { ...status, changes: 0, files: [] }; } }).client);
    await store.actions.commit("Tighter headline");
    expect(messages).toEqual(["Tighter headline"]);
    expect(store.getState()).toMatchObject({ git: { changes: 0 }, toast: { tone: "success", text: "Committed" } });
  });
  it("refreshes git whenever the page reloads", async () => {
    const store = createFakeStore({ page: "Home" });
    await createStoreContext(createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) }).client, store).reloadPage();
    expect(store.calls.map((c) => c.name)).toEqual(["refreshGit"]);
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- IF refreshing Git fails THEN THE SYSTEM SHALL keep the last status and show no toast. (test: "refreshes quietly and keeps the last status on failure")
- WHEN the page reloads THE SYSTEM SHALL start a Git refresh. (test: "refreshes git whenever the page reloads")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T083`.
The last line must be `GATE PASS T083`. On `GATE FAIL T083 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T083` prints `GATE PASS T083`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T083: Add Git actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
