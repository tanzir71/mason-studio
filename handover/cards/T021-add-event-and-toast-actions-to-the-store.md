# T021: Add event and toast actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T021 (build), phase 3 |
| Depends on | T020 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R12 |

**Create:** `src/ui/state/event-actions.ts`, `tests/ui/event-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T021`):

1. `npx vitest run tests/ui/event-actions.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Server events update the store (reload on writes and external changes, live proposals) and toasts can be shown and dismissed.

## Context

UI state module. Third action slice; registers in `create-store.ts`. S005 connects `client.subscribe` to `handleEvent`.

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
export type MasonEvent =
  | { type: "written"; files: string[]; revision: number }
```

## Current state

`src/ui/state/create-store.ts` registers the project and view slices above `// @seam:slices` and imports them above `// @seam:imports`.

## Steps

1. Create `src/ui/state/event-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createEventActions(ctx: StoreContext): Pick<StudioActions, "handleEvent" | "showToast" | "dismissToast"> {
  return {
    handleEvent(event) {
      if (event.type === "written") {
        if (event.revision === ctx.get().revision) return;
        ctx.set({ revision: event.revision });
        ctx.reloadPage().catch(() => {});
      } else if (event.type === "external-change") {
        ctx.set((s) => ({ revision: s.revision + 1 }));
        ctx.reloadPage().catch(() => {});
      } else if (event.type === "proposal") {
        ctx.set((s) => ({ proposals: [event.proposal, ...s.proposals.filter((p) => p.id !== event.proposal.id)] }));
      }
    },
    showToast(tone, text, undo) { ctx.toast(tone, text, undo); },
    dismissToast() { ctx.set({ toast: null }); },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createEventActions } from "./event-actions.ts";` directly above `// @seam:imports`, and `  Object.assign(actions, createEventActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/event-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it, vi } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, Proposal } from "../../src/contracts/model.ts";

const proposal = (id: string, summary: string) => ({ id, summary } as Proposal);

describe("event actions", () => {
  it("reloads the tree for a written event from another client", async () => {
    let loads = 0;
    const store = createStudioStore(createFakeClient({ pageTree: async () => { loads += 1; return { tag: "body" } as ElementNode; } }).client);
    store.setState({ page: "Home", revision: 2 });
    store.actions.handleEvent({ type: "written", files: ["a.css"], revision: 2 });
    expect(loads).toBe(0);
    store.actions.handleEvent({ type: "written", files: ["a.css"], revision: 3 });
    expect(store.getState().revision).toBe(3);
    await vi.waitFor(() => expect(loads).toBe(1));
  });
  it("bumps the revision on external changes", () => {
    const store = createStudioStore(createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) }).client);
    store.setState({ page: "Home", revision: 5 });
    store.actions.handleEvent({ type: "external-change", files: ["index.html"] });
    expect(store.getState().revision).toBe(6);
  });
  it("puts proposals first and replaces them by id", () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ proposals: [proposal("a", "old"), proposal("b", "b")] });
    store.actions.handleEvent({ type: "proposal", proposal: proposal("a", "new") });
    expect(store.getState().proposals.map((p) => [p.id, p.summary])).toEqual([["a", "new"], ["b", "b"]]);
  });
  it("shows and dismisses toasts", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.showToast("info", "Hello", false);
    store.actions.showToast("success", "Saved", true);
    expect(store.getState().toast).toEqual({ id: 2, tone: "success", text: "Saved", undo: true });
    store.actions.dismissToast();
    expect(store.getState().toast).toBeNull();
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN a written event arrives with a new revision THE SYSTEM SHALL take that revision and reload the page; an equal revision is ignored. (test: "reloads the tree for a written event from another client")
- WHEN an external change arrives THE SYSTEM SHALL increase the revision by 1. (test: "bumps the revision on external changes")
- WHEN a proposal event arrives THE SYSTEM SHALL put it first, replacing one with the same id. (test: "puts proposals first and replaces them by id")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T021`.
The last line must be `GATE PASS T021`. On `GATE FAIL T021 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T021` prints `GATE PASS T021`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T021: Add event and toast actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
