# T077: Add agent, proposal and settings actions to the store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T077 (build), phase 9 |
| Depends on | T041 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R31, R32, R30 |

**Create:** `src/ui/state/agent-actions.ts`, `tests/ui/agent-actions.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T077`):

1. `npx vitest run tests/ui/agent-actions.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The store opens the agent prompt, asks the agent, accepts and rejects proposals, and opens and saves settings.

## Context

UI state module. The prompt needs a selection; on an agent error the prompt stays open so the request is not lost.

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
export interface AskInput { page: string; path: ElementPath; prompt: string; scope: Scope }
export interface Proposal { id: string; source: string; page: string; summary: string; createdAt: number; status: ProposalStatus; changes: ProposalChange[] }
export interface Settings { agent: AgentSettings; hasApiKey: boolean; mcpEnabled: boolean; theme: "dark" | "light" }
```

## Current state

`create-store.ts` registers project, view, event, write, element, asset, code and check slices.

## Steps

1. Create `src/ui/state/agent-actions.ts` with exactly this content:

```ts
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createAgentActions(ctx: StoreContext): Pick<StudioActions,
  "openAgentPrompt" | "closeAgentPrompt" | "askAgent" | "loadProposals" | "acceptProposal" | "rejectProposal" |
  "openSettings" | "closeSettings" | "saveSettings"> {
  const { client } = ctx;
  return {
    openAgentPrompt() {
      if (ctx.get().selection === null) { ctx.toast("info", "Select a layer first, then ask the agent about it.", false); return; }
      ctx.set({ agentPrompt: { open: true, busy: false } });
    },
    closeAgentPrompt() { ctx.set({ agentPrompt: { open: false, busy: false } }); },
    async askAgent(prompt) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      ctx.set({ agentPrompt: { open: true, busy: true } });
      try {
        const proposal = await client.askAgent({ page, path: selection, prompt, scope });
        ctx.set((s) => ({ proposals: [proposal, ...s.proposals.filter((p) => p.id !== proposal.id)], agentPrompt: { open: false, busy: false } }));
      } catch (error) {
        ctx.set({ agentPrompt: { open: true, busy: false } });
        ctx.toast("error", error instanceof Error ? error.message : String(error), false);
      }
    },
    loadProposals: () => ctx.run(async () => { ctx.set({ proposals: await client.proposals() }); }),
    async acceptProposal(id, includeBlocked) {
      const result = await ctx.write(() => client.acceptProposal(id, includeBlocked));
      if (result) ctx.set((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? { ...p, status: "accepted" as const } : p)) }));
    },
    rejectProposal: (id) => ctx.run(async () => {
      const proposal = await client.rejectProposal(id);
      ctx.set((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? proposal : p)) }));
    }),
    openSettings() {
      ctx.set({ settingsOpen: true });
      client.settings().then((settings) => ctx.set({ settings })).catch(() => {});
    },
    closeSettings() { ctx.set({ settingsOpen: false }); },
    saveSettings: (settings) => ctx.run(async () => {
      const saved = await client.saveSettings(settings);
      ctx.set({ settings: saved, settingsOpen: false });
      ctx.toast("success", "Settings saved", false);
    }),
  };
}
```

2. In `src/ui/state/create-store.ts` insert `import { createAgentActions } from "./agent-actions.ts";` directly above `// @seam:imports` and `  Object.assign(actions, createAgentActions(ctx));` directly above `  // @seam:slices`.

3. Create `tests/ui/agent-actions.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { AskInput, ElementNode, Proposal } from "../../src/contracts/model.ts";

const proposal = (id: string, status: Proposal["status"] = "pending") => ({ id, status, changes: [] } as unknown as Proposal);

describe("agent actions", () => {
  it("opens the prompt only with a selection", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.openAgentPrompt();
    expect(store.getState().agentPrompt.open).toBe(false);
    expect(store.getState().toast).toMatchObject({ text: "Select a layer first, then ask the agent about it." });
    store.setState({ selection: "1" });
    store.actions.openAgentPrompt();
    expect(store.getState().agentPrompt).toEqual({ open: true, busy: false });
  });
  it("asks the agent and puts the proposal first", async () => {
    const asked: AskInput[] = [];
    const store = createStudioStore(createFakeClient({ askAgent: async (i) => { asked.push(i); return proposal("p2"); } }).client);
    store.setState({ page: "Home", selection: "1.0", scope: "tablet", proposals: [proposal("p1")], agentPrompt: { open: true, busy: false } });
    await store.actions.askAgent("Smaller");
    expect(asked).toEqual([{ page: "Home", path: "1.0", prompt: "Smaller", scope: "tablet" }]);
    expect(store.getState().proposals.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(store.getState().agentPrompt).toEqual({ open: false, busy: false });
  });
  it("keeps the prompt open with an error toast when the agent fails", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ page: "Home", selection: "1.0", agentPrompt: { open: true, busy: false } });
    await store.actions.askAgent("x");
    expect(store.getState().agentPrompt).toEqual({ open: true, busy: false });
    expect(store.getState().toast).toMatchObject({ tone: "error", text: "Not implemented yet. askAgent" });
  });
  it("accepts and rejects proposals", async () => {
    const { client } = createFakeClient({
      acceptProposal: async () => ({ files: ["styles.css"], revision: 4, effective: true, path: null, message: "Applied 1 change from Claude Code" }),
      rejectProposal: async (id) => proposal(id, "rejected"),
      pageTree: async () => ({ tag: "body" } as ElementNode),
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home", proposals: [proposal("a"), proposal("b")] });
    await store.actions.acceptProposal("a", false);
    await store.actions.rejectProposal("b");
    expect(store.getState().proposals.map((p) => [p.id, p.status])).toEqual([["a", "accepted"], ["b", "rejected"]]);
    expect(store.getState().revision).toBe(4);
  });
  it("opens, saves and closes settings", async () => {
    const { client } = createFakeClient({ settings: async () => DEFAULT_SETTINGS, saveSettings: async (s) => ({ ...s, hasApiKey: true }) });
    const store = createStudioStore(client);
    store.actions.openSettings();
    expect(store.getState().settingsOpen).toBe(true);
    await store.actions.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    expect(store.getState()).toMatchObject({ settingsOpen: false, settings: { mcpEnabled: true, hasApiKey: true }, toast: { text: "Settings saved" } });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- IF nothing is selected THEN THE SYSTEM SHALL keep the prompt closed and explain why. (test: "opens the prompt only with a selection")
- WHEN the agent answers THE SYSTEM SHALL put the proposal first and close the prompt. (test: "asks the agent and puts the proposal first")
- WHEN a proposal is accepted or rejected THE SYSTEM SHALL update its status. (test: "accepts and rejects proposals")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T077`.
The last line must be `GATE PASS T077`. On `GATE FAIL T077 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T077` prints `GATE PASS T077`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T077: Add agent, proposal and settings actions to the store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
