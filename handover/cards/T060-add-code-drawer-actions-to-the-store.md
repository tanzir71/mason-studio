# T060: Add code drawer actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T060 (build), phase 7 |
| Depends on | T041 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R27 |

**Create:** `src/ui/state/code-actions.ts`, `tests/ui/code-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T060`):

1. `npx vitest run tests/ui/code-actions.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store opens a file in the code drawer at a line, tracks edits, saves through `writeFile` and closes the drawer.

## Context

UI state module. Saving uses `ctx.write`, so it shows the usual toast with Undo and reloads the page.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export interface CodeState { open: boolean; file: string | null; line: number | null; text: string | null; dirty: boolean }
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

`create-store.ts` registers project, view, event, write, element and asset slices.

## Steps

1. Create `src/ui/state/code-actions.ts` with exactly this content:

```ts
import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createCodeActions(ctx: StoreContext): Pick<StudioActions, "openCode" | "editCode" | "saveCode" | "closeCode"> {
  const { client } = ctx;
  return {
    openCode: (file, line) => ctx.run(async () => {
      const { path, text } = await client.readFile(file);
      ctx.set({ code: { open: true, file: path, line, text, dirty: false } });
    }),
    editCode(text) {
      ctx.set((s) => ({ code: { ...s.code, text, dirty: true } }));
    },
    async saveCode() {
      const { file, text, dirty } = ctx.get().code;
      if (!file || text === null || !dirty) return;
      const result = await ctx.write(() => client.writeFile(file, text));
      if (result && ctx.get().code.file === file) ctx.set((s) => ({ code: { ...s.code, dirty: s.code.text !== text } }));
    },
    closeCode() {
      ctx.set({ code: INITIAL_STATE.code });
    },
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createCodeActions } from "./code-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createCodeActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/code-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode } from "../../src/contracts/model.ts";

describe("code actions", () => {
  it("opens, edits, saves and closes a file", async () => {
    const writes: unknown[][] = [];
    const { client } = createFakeClient({
      readFile: async (path) => ({ path, text: "a {}\n" }),
      writeFile: async (...a) => { writes.push(a); return { files: ["styles.css"], revision: 2, effective: true, path: null, message: "Saved to styles.css" }; },
      pageTree: async () => ({ tag: "body" } as ElementNode),
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home" });
    await store.actions.openCode("styles.css", 22);
    expect(store.getState().code).toEqual({ open: true, file: "styles.css", line: 22, text: "a {}\n", dirty: false });
    store.actions.editCode("b {}\n");
    expect(store.getState().code).toMatchObject({ text: "b {}\n", dirty: true });
    await store.actions.saveCode();
    expect(writes).toEqual([["styles.css", "b {}\n"]]);
    expect(store.getState().code.dirty).toBe(false);
    expect(store.getState().revision).toBe(2);
    store.actions.closeCode();
    expect(store.getState().code).toEqual({ open: false, file: null, line: null, text: null, dirty: false });
  });
  it("does not save a clean file", async () => {
    let writes = 0;
    const store = createStudioStore(createFakeClient({ writeFile: async () => { writes += 1; throw new Error("x"); } }).client);
    store.setState({ code: { open: true, file: "a.css", line: null, text: "a", dirty: false } });
    await store.actions.saveCode();
    expect(writes).toBe(0);
  });
  it("shows an error toast when the file cannot be read", async () => {
    const store = createStudioStore(createFakeClient().client);
    await store.actions.openCode("x.css", null);
    expect(store.getState().code.open).toBe(false);
    expect(store.getState().toast).toMatchObject({ tone: "error" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN a file is opened, edited and saved THE SYSTEM SHALL track dirty state and write the text. (test: "opens, edits, saves and closes a file")
- THE SYSTEM SHALL not save a clean file. (test: "does not save a clean file")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T060`.
The last line must be `GATE PASS T060`. On `GATE FAIL T060 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T060` prints `GATE PASS T060`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T060: Add code drawer actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
