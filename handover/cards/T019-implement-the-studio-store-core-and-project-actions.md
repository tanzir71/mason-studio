# T019: Implement the studio store core and project actions

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T019 (build), phase 3 |
| Depends on | T018 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R14 |

**Create:** `src/ui/state/store-context.ts`, `src/ui/state/project-actions.ts`, `tests/ui/store-context.test.ts`, `tests/ui/store-core.test.ts`

**Modify:** `src/ui/state/create-store.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T019`):

1. `npx vitest run tests/ui/store-context.test.ts tests/ui/store-core.test.ts` -> exit 0, output contains `Tests  12 passed (12)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createStudioStore(client)` returns a working store with the shared action helpers and the project actions (init, open, create, close, select page, create page).

## Context

UI state module. Replaces the T002 stub. Later cards add action slices by inserting one import above `// @seam:imports` and one `Object.assign(actions, ...)` line above `// @seam:slices` in `create-store.ts` (same module). Until a slice exists, its actions show the info toast "<name> is not available yet.".

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
export const INITIAL_STATE: StudioState = {
  screen: "start", project: null, recent: [], templates: [], page: null, tree: null, selection: null, hover: null,
  scope: "all", activeBoard: "desktop", tool: "move", leftTab: "layers", rightTab: "design", zoom: 0.34,
  pan: { x: 0, y: 0 }, inspect: null, tokens: null, checks: null, contrast: [], proposals: [],
  code: { open: false, file: null, line: null, text: null, dirty: false }, git: null, settings: null,
  settingsOpen: false, agentPrompt: { open: false, busy: false }, toast: null, revision: 0, busy: false,
};
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
export interface StudioStore {
  getState(): StudioState;
  setState(patch: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)): void;
  subscribe(listener: () => void): () => void;
  actions: StudioActions;
}
/** StudioService over HTTP plus the /api/events stream. */
export type MasonClient = StudioService & { subscribe(listener: (event: MasonEvent) => void): () => void };
/** src/ui/state/create-store.ts */
export type CreateStudioStore = (client: MasonClient) => StudioStore;
```

## Current state

`src/ui/state/create-store.ts` is a stub that throws NOT_IMPLEMENTED. `src/ui/state/store-context.ts` and `src/ui/state/project-actions.ts` do not exist.

## Steps

1. Create `src/ui/state/store-context.ts` with exactly this content:

```ts
import type { StudioState, StudioStore, MasonClient, StudioActions, Toast } from "../../contracts/ui.tsx";
import type { WriteResult } from "../../contracts/model.ts";

/** Every StudioActions name. create-store.ts fills each with a placeholder before the slices are assigned. */
export const STORE_ACTION_NAMES = [
  "init", "openProject", "createProject", "closeProject", "selectPage", "createPage", "select", "hover", "setScope",
  "setActiveBoard", "setTool", "setLeftTab", "setRightTab", "setZoom", "panBy", "applyStyle", "resetStyle",
  "insertElement", "editText", "removeSelected", "moveElement", "wrapSelected", "undo", "redo", "loadTokens",
  "importTokens", "exportTokens", "runChecks", "setContrast", "openCode", "editCode", "saveCode", "closeCode",
  "refreshGit", "commit", "openAgentPrompt", "closeAgentPrompt", "askAgent", "loadProposals", "acceptProposal",
  "rejectProposal", "openSettings", "closeSettings", "saveSettings", "handleEvent", "showToast", "dismissToast",
] as const satisfies readonly (keyof StudioActions)[];

/** What every action slice receives. */
export interface StoreContext {
  client: MasonClient;
  get(): StudioState;
  set(patch: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)): void;
  /** The store's full actions object; slices call each other through it. */
  actions: StudioActions;
  /** toast = { id: (previous toast id, or 0) + 1, tone, text, undo }. */
  toast(tone: Toast["tone"], text: string, undo: boolean): void;
  /** Awaits fn; any thrown error becomes toast("error", message, false). Never rejects. */
  run(fn: () => Promise<void>): Promise<void>;
  /** busy = true; result = await fn(); afterWrite(result); returns result. Errors → error toast, busy = false, returns null. */
  write(fn: () => Promise<WriteResult>): Promise<WriteResult | null>;
  /** revision = result.revision, busy = false, toast("success", result.message, true), then reloadPage(). */
  afterWrite(result: WriteResult): Promise<void>;
  /** With a page open: tree = pageTree(page); with a selection: inspect = inspect(page, selection), or null when that fails. */
  reloadPage(): Promise<void>;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createStoreContext(client: MasonClient, store: StudioStore): StoreContext {
  let toastId = 0;
  const ctx: StoreContext = {
    client,
    get: () => store.getState(),
    set: (patch) => store.setState(patch),
    actions: store.actions,
    toast(tone, text, undo) {
      toastId = Math.max(toastId, store.getState().toast?.id ?? 0) + 1;
      store.setState({ toast: { id: toastId, tone, text, undo } });
    },
    async run(fn) {
      try { await fn(); } catch (error) { ctx.toast("error", messageOf(error), false); }
    },
    async write(fn) {
      store.setState({ busy: true });
      try {
        const result = await fn();
        await ctx.afterWrite(result);
        return result;
      } catch (error) {
        store.setState({ busy: false });
        ctx.toast("error", messageOf(error), false);
        return null;
      }
    },
    async afterWrite(result) {
      store.setState({ revision: result.revision, busy: false });
      ctx.toast("success", result.message, true);
      await ctx.reloadPage();
    },
    async reloadPage() {
      const { page } = store.getState();
      if (!page) return;
      const tree = await client.pageTree(page);
      if (store.getState().page !== page) return;
      store.setState({ tree });
      const selection = store.getState().selection;
      if (selection === null) return;
      try {
        const inspect = await client.inspect(page, selection);
        if (store.getState().selection === selection) store.setState({ inspect });
      } catch {
        store.setState({ inspect: null });
      }
    },
  };
  return ctx;
}
```

2. Create `src/ui/state/project-actions.ts` with exactly this content:

```ts
import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { ProjectInfo } from "../../contracts/model.ts";
import type { StoreContext } from "./store-context.ts";

/** Switches to the canvas for `project`: first page, its tree, then git, tokens and proposals (each optional). */
export async function enterProject(ctx: StoreContext, project: ProjectInfo): Promise<void> {
  const page = project.pages[0]?.name ?? null;
  ctx.set({
    screen: "canvas", project, page, tree: null, selection: null, hover: null, inspect: null, checks: null,
    contrast: [], code: INITIAL_STATE.code, scope: "all", activeBoard: "desktop", tool: "move",
  });
  if (page) ctx.set({ tree: await ctx.client.pageTree(page) });
  const [git, tokens, proposals] = await Promise.all([
    ctx.client.gitStatus().catch(() => null),
    ctx.client.tokens().catch(() => null),
    ctx.client.proposals().catch(() => []),
  ]);
  ctx.set({ git, tokens, proposals });
}

export function createProjectActions(ctx: StoreContext): Pick<StudioActions,
  "init" | "openProject" | "createProject" | "closeProject" | "selectPage" | "createPage"> {
  const { client } = ctx;
  return {
    init: () => ctx.run(async () => {
      const [recent, templates, settings] = await Promise.all([
        client.recentProjects().catch(() => []),
        client.templates().catch(() => []),
        client.settings().catch(() => null),
      ]);
      ctx.set({ recent, templates, settings });
      let project: ProjectInfo;
      try { project = await client.currentProject(); } catch { return; }
      await enterProject(ctx, project);
    }),
    openProject: (root) => ctx.run(async () => { await enterProject(ctx, await client.openProject(root)); }),
    createProject: (root, template) => ctx.run(async () => { await enterProject(ctx, await client.createProject(root, template)); }),
    closeProject() {
      ctx.set({ screen: "start", project: null, page: null, tree: null, selection: null, hover: null, inspect: null, checks: null, contrast: [] });
      client.recentProjects().then((recent) => ctx.set({ recent })).catch(() => {});
    },
    selectPage: (name) => ctx.run(async () => {
      ctx.set({ page: name, tree: null, selection: null, hover: null, inspect: null, checks: null, contrast: [] });
      const tree = await client.pageTree(name);
      if (ctx.get().page === name) ctx.set({ tree });
    }),
    createPage: (name) => ctx.run(async () => {
      const info = await client.createPage(name);
      ctx.set({ project: await client.currentProject() });
      await ctx.actions.selectPage(info.name);
    }),
  };
}
```

3. Replace the whole content of `src/ui/state/create-store.ts` with exactly:

```ts
import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { CreateStudioStore, StudioActions, StudioState, StudioStore } from "../../contracts/ui.tsx";
import { createStoreContext, STORE_ACTION_NAMES } from "./store-context.ts";
import { createProjectActions } from "./project-actions.ts";
// @seam:imports

export const createStudioStore: CreateStudioStore = (client) => {
  let state: StudioState = INITIAL_STATE;
  const listeners = new Set<() => void>();
  const actions = {} as StudioActions;
  const store: StudioStore = {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      for (const l of [...listeners]) l();
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    actions,
  };
  const ctx = createStoreContext(client, store);
  for (const name of STORE_ACTION_NAMES) {
    (actions as unknown as Record<string, unknown>)[name] = () => {
      ctx.toast("info", `${name} is not available yet.`, false);
      return Promise.resolve();
    };
  }
  Object.assign(actions, createProjectActions(ctx));
  // @seam:slices
  return store;
};
```

4. Create `tests/ui/store-context.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStoreContext } from "../../src/ui/state/store-context.ts";
import { createFakeClient, createFakeStore } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, InspectResult, WriteResult } from "../../src/contracts/model.ts";

const result: WriteResult = { files: ["styles.css"], revision: 4, effective: true, path: null, message: "Saved to styles.css" };

describe("store context", () => {
  it("numbers toasts from the previous id", () => {
    const store = createFakeStore({ toast: { id: 7, tone: "info", text: "x", undo: false } });
    const ctx = createStoreContext(createFakeClient().client, store);
    ctx.toast("success", "Saved", true);
    expect(store.getState().toast).toEqual({ id: 8, tone: "success", text: "Saved", undo: true });
  });
  it("write applies the result, toasts and reloads tree and inspect", async () => {
    const { client } = createFakeClient({
      pageTree: async () => ({ tag: "body" } as ElementNode),
      inspect: async (_p, path) => ({ path } as InspectResult),
    });
    const store = createFakeStore({ page: "Home", selection: "1.0" });
    const ctx = createStoreContext(client, store);
    const r = await ctx.write(async () => result);
    expect(r).toBe(result);
    expect(store.getState()).toMatchObject({ revision: 4, busy: false, toast: { tone: "success", text: "Saved to styles.css", undo: true }, tree: { tag: "body" }, inspect: { path: "1.0" } });
  });
  it("write turns a failure into an error toast and returns null", async () => {
    const store = createFakeStore({ page: "Home" });
    const ctx = createStoreContext(createFakeClient().client, store);
    expect(await ctx.write(async () => { throw new Error("nope"); })).toBeNull();
    expect(store.getState()).toMatchObject({ busy: false, toast: { tone: "error", text: "nope", undo: false } });
  });
  it("reloadPage sets inspect to null when inspect fails", async () => {
    const { client } = createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) });
    const store = createFakeStore({ page: "Home", selection: "9", inspect: { path: "9" } as InspectResult });
    await createStoreContext(client, store).reloadPage();
    expect(store.getState().inspect).toBeNull();
  });
});
```

5. Create `tests/ui/store-core.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import type { ElementNode, PageInfo, ProjectInfo } from "../../src/contracts/model.ts";
import { STORE_ACTION_NAMES } from "../../src/ui/state/store-context.ts";
import { BREAKPOINTS } from "../../src/contracts/model.ts";

const page = (name: string, file: string): PageInfo => ({ name, file, title: name, stylesheets: ["styles.css"] });
const project: ProjectInfo = { root: "/p", name: "p", pages: [page("Home", "index.html"), page("Menu", "menu.html")], breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false };
const tree = (tag: string) => ({ tag, path: "", children: [] } as unknown as ElementNode);

describe("store core and project actions", () => {
  it("starts from INITIAL_STATE and notifies subscribers", () => {
    const store = createStudioStore(createFakeClient().client);
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setState({ zoom: 1 });
    store.setState((s) => ({ zoom: s.zoom + 0.5 }));
    expect([store.getState().zoom, store.getState().screen, calls]).toEqual([1.5, "start", 2]);
  });
  it("init stays on the start screen when no project is open", async () => {
    const { client } = createFakeClient({
      recentProjects: async () => [{ root: "/a", name: "a", openedAt: 1 }],
      templates: async () => [],
      currentProject: async () => { throw new MasonError("NO_PROJECT"); },
    });
    const store = createStudioStore(client);
    await store.actions.init();
    expect(store.getState()).toMatchObject({ screen: "start", recent: [{ root: "/a" }], settings: null, toast: null });
  });
  it("init enters the open project with its first page", async () => {
    const { client } = createFakeClient({ currentProject: async () => project, pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    await store.actions.init();
    expect(store.getState()).toMatchObject({ screen: "canvas", page: "Home", tree: { tag: "Home" }, git: null, tokens: null, proposals: [] });
  });
  it("selectPage loads the tree and clears the selection", async () => {
    const { client } = createFakeClient({ pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    store.setState({ screen: "canvas", project, page: "Home", selection: "1.0" });
    await store.actions.selectPage("Menu");
    expect(store.getState()).toMatchObject({ page: "Menu", selection: null, tree: { tag: "Menu" } });
  });
  it("turns action errors into error toasts", async () => {
    const store = createStudioStore(createFakeClient({ openProject: async () => { throw new MasonError("NOT_A_PROJECT", "/x"); } }).client);
    await store.actions.openProject("/x");
    expect(store.getState().toast).toEqual({ id: 1, tone: "error", text: "That folder has no .html files. /x", undo: false });
    expect(store.getState().screen).toBe("start");
  });
  it("createPage refreshes the project and opens the new page", async () => {
    const withPage = { ...project, pages: [...project.pages, page("Wholesale", "wholesale.html")] };
    const { client } = createFakeClient({ createPage: async () => page("Wholesale", "wholesale.html"), currentProject: async () => withPage, pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    store.setState({ screen: "canvas", project, page: "Home" });
    await store.actions.createPage("Wholesale");
    expect(store.getState().project!.pages.length).toBe(3);
    expect(store.getState().page).toBe("Wholesale");
  });
  it("closeProject returns to the start screen", () => {
    const store = createStudioStore(createFakeClient({ recentProjects: async () => [] }).client);
    store.setState({ screen: "canvas", project, page: "Home", selection: "0" });
    store.actions.closeProject();
    expect(store.getState()).toMatchObject({ screen: "start", project: null, page: null, selection: null });
  });
  it("exposes every action as a function", () => {
    const store = createStudioStore(createFakeClient().client);
    for (const name of STORE_ACTION_NAMES) expect(typeof store.actions[name]).toBe("function");
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL number toasts from the previous toast id. (test: "numbers toasts from the previous id")
- WHEN a write succeeds THE SYSTEM SHALL set the revision, show a success toast with undo and reload tree and inspect. (test: "write applies the result, toasts and reloads tree and inspect")
- WHEN init finds an open project THE SYSTEM SHALL switch to the canvas with the first page. (test: "init enters the open project with its first page")
- IF an action fails THEN THE SYSTEM SHALL show an error toast with the error message. (test: "turns action errors into error toasts")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T019`.
The last line must be `GATE PASS T019`. On `GATE FAIL T019 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/state/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T019` prints `GATE PASS T019`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T019: Implement the studio store core and project actions
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
