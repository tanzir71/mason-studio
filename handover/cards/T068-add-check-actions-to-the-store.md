# T068: Add check actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T068 (build), phase 8 |
| Depends on | T041 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R29 |

**Create:** `src/ui/state/check-actions.ts`, `tests/ui/check-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T068`):

1. `npx vitest run tests/ui/check-actions.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store runs checks for the open page and keeps the browser's contrast findings.

## Context

UI state module. selectPage already clears `checks` and `contrast`.

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

`create-store.ts` registers project, view, event, write, element, asset and code slices.

## Steps

1. Create `src/ui/state/check-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createCheckActions(ctx: StoreContext): Pick<StudioActions, "runChecks" | "setContrast"> {
  return {
    runChecks: () => ctx.run(async () => {
      const page = ctx.get().page;
      if (page === null) return;
      const checks = await ctx.client.checks(page);
      if (ctx.get().page === page) ctx.set({ checks });
    }),
    setContrast(contrast) { ctx.set({ contrast }); },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createCheckActions } from "./check-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createCheckActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/check-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { CheckFinding, CheckReport } from "../../src/contracts/model.ts";

describe("check actions", () => {
  it("runs checks for the open page", async () => {
    const report: CheckReport = { page: "Home", findings: [], passed: ["Headings in order"] };
    const pages: string[] = [];
    const store = createStudioStore(createFakeClient({ checks: async (p) => { pages.push(p); return report; } }).client);
    await store.actions.runChecks();
    expect(pages).toEqual([]);
    store.setState({ page: "Home" });
    await store.actions.runChecks();
    expect([pages, store.getState().checks]).toEqual([["Home"], report]);
  });
  it("stores contrast findings", () => {
    const store = createStudioStore(createFakeClient().client);
    const f = { id: "a11y:contrast:1" } as CheckFinding;
    store.actions.setContrast([f]);
    expect(store.getState().contrast).toEqual([f]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN runChecks runs with a page open THE SYSTEM SHALL store that page's report; without a page it does nothing. (test: "runs checks for the open page")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T068`.
The last line must be `GATE PASS T068`. On `GATE FAIL T068 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T068` prints `GATE PASS T068`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T068: Add check actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
