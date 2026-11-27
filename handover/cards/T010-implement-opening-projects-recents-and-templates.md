# T010: Implement opening projects, recents and templates

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T010 (build), phase 2 |
| Depends on | T008 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R6, R7 |

**Create:** `src/engine/studio/project-group.ts`, `tests/helpers/fixture.ts`, `tests/engine/project-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** `src/engine/studio/context.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T010`):

1. `npx vitest run tests/engine/project-group.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`openProject`, `currentProject`, `recentProjects` and `templates` work on the studio.

## Context

Engine module, studio area. First studio group. It registers itself in `create-studio.ts` at the `@seam:groups` anchor (same module, so this build card does the registration). T011 adds createProject to the same file; T012 adds the page group.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/**
 * Everything the UI, HTTP and MCP layers can do. Implemented by createStudio (src/engine/studio/).
 * Every method rejects with MasonError on failure. Methods that need an open project reject with NO_PROJECT.
 * Every write records one undo step, increments the revision and emits { type: "written" }.
 */
export interface StudioService {
  /** Opens a folder containing at least one top-level .html file (else NOT_A_PROJECT); records it in recent projects; emits project-opened. */
  openProject(root: string): Promise<ProjectInfo>;
  /** Copies templates/<template>/ into root (must be missing or empty, else FOLDER_NOT_EMPTY), then openProject(root). */
  createProject(root: string, template: TemplateId): Promise<ProjectInfo>;
  currentProject(): Promise<ProjectInfo>;
  recentProjects(): Promise<RecentProject[]>;          // newest first, max 8
  templates(): Promise<TemplateInfo[]>;                 // order: landing, portfolio, docs, blank
  /** Creates `${slug}.html` from the first page's <head> with an empty <main>; PAGE_EXISTS when present. */
  createPage(name: string): Promise<PageInfo>;
  pageTree(page: string): Promise<ElementNode>;         // body node; PAGE_NOT_FOUND
  inspect(page: string, path: ElementPath): Promise<InspectResult>;
  applyStyle(change: StyleChange): Promise<WriteResult>;
  resetStyle(page: string, path: ElementPath, prop: string, scope: Scope): Promise<WriteResult>;
  insertElement(page: string, parentPath: ElementPath, index: number, kind: InsertKind): Promise<WriteResult>;
  editText(page: string, path: ElementPath, text: string): Promise<WriteResult>;
  removeElement(page: string, path: ElementPath): Promise<WriteResult>;
  moveElement(page: string, path: ElementPath, toIndex: number): Promise<WriteResult>;
  wrapInStack(page: string, path: ElementPath): Promise<WriteResult>;
  undo(): Promise<WriteResult>;                          // NOTHING_TO_UNDO
  redo(): Promise<WriteResult>;                          // NOTHING_TO_REDO
  readFile(path: string): Promise<FileText>;
  writeFile(path: string, text: string): Promise<WriteResult>;
  tokens(): Promise<TokenSet>;                           // tokens.json at the root, or { tokens: [], file: null }
  importTokens(format: TokenFormat, json: string): Promise<TokenSet>; // writes tokens.json (DTCG) and tokens.css
  exportTokens(): Promise<WriteResult>;                  // rewrites tokens.css from tokens.json
  checks(page: string): Promise<CheckReport>;
  gitStatus(): Promise<GitStatus>;
  commit(message: string): Promise<GitStatus>;           // empty message → INVALID_INPUT; failure → GIT_FAILED
  proposals(): Promise<Proposal[]>;                       // newest first
  propose(input: ProposalInput): Promise<Proposal>;      // validates, labels, taste-checks; emits { type: "proposal" }
  acceptProposal(id: string, includeBlocked: boolean): Promise<WriteResult>;
  rejectProposal(id: string): Promise<Proposal>;
  askAgent(input: AskInput): Promise<Proposal>;          // LLM → propose(); source = settings.agent.model
  settings(): Promise<Settings>;                          // agent.apiKey is always "" here; hasApiKey tells if one is stored
  saveSettings(settings: Settings): Promise<Settings>;   // agent.apiKey "" keeps the stored key
}
```

```ts
// src/contracts/model.ts
export interface ProjectInfo { root: string; name: string; pages: PageInfo[]; breakpoints: Breakpoint[]; hasTokens: boolean; hasTaste: boolean }
export interface PageInfo { name: string; file: string; title: string; stylesheets: string[] }
export interface RecentProject { root: string; name: string; openedAt: number }
export interface TemplateInfo { id: TemplateId; name: string; meta: string }
/** Fixed breakpoint row shown for every page, in this order. */
export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 768, maxWidth: 768 },
  { id: "mobile", label: "Mobile", width: 375, maxWidth: 375 },
];
```

```ts
// src/contracts/fakes.ts (protected, tests only)
export function createTestDeps(projects?: Record<string, Record<string, string>>, templates?: Record<string, string>): TestDeps;
// TestDeps: openFs(root) returns an InMemoryFileSystem per root; templates live at root "/templates"; events.emitted records events.
```

## Current state

`src/engine/studio/context.ts` (T002) exports `EngineContext`, `createEngineContext`, `requireFs`, `requireProject`. `src/engine/studio/create-studio.ts` contains:

```ts
import { createEngineContext } from "./context.ts";
// @seam:imports

export const createStudio: CreateStudio = (deps: StudioDeps): StudioService => {
  const ctx = createEngineContext(deps);
  const studio: Record<string, unknown> = {};
  for (const m of STUDIO_METHODS) studio[m] = async () => { throw new MasonError("NOT_IMPLEMENTED", m); };
  // @seam:groups
  return studio as unknown as StudioService;
};
```

`src/engine/html/parse.ts` exports `parsePage`; `src/engine/html/names.ts` exports `humanize`.

## Steps

1. Create `src/engine/studio/project-group.ts` exporting `pageNameOf(file: string): string` (`"index.html"` → `"Home"`, else `humanize(file without ".html")`), `scanPages(fs: FileSystem): Promise<PageInfo[]>` and `createProjectGroup(ctx: EngineContext): Pick<StudioService, "openProject" | "currentProject" | "recentProjects" | "templates">`.

2. `scanPages(fs)`: files = `await fs.list("")` filtered to names without "/" that end with ".html"; sort with "index.html" first, then alphabetically; for each: `const model = parsePage(file, await fs.readText(file))` → `{ name: pageNameOf(file), file, title: model.title, stylesheets: model.stylesheets }`.

3. `openProject(root)`: `const fs = ctx.deps.openFs(root)`; `pages = await scanPages(fs)`; no pages → throw `new MasonError("NOT_A_PROJECT", root)`. name = last non-empty segment of root split on `/` or `\\`. Build `ProjectInfo` with `breakpoints: [...BREAKPOINTS]`, `hasTokens: await fs.exists("tokens.json")`, `hasTaste: await fs.exists(".mason/taste.md")`. Set `ctx.project`, `ctx.fs`, and reset `ctx.undoStack = []`, `ctx.redoStack = []`, `ctx.proposals = []`. Then `const stored = await ctx.deps.settings.load()`; `stored.recent = [{ root, name, openedAt: ctx.deps.now() }, ...stored.recent.filter((r) => r.root !== root)].slice(0, 8)`; `await ctx.deps.settings.save(stored)`. Emit `{ type: "project-opened", project }` with `ctx.deps.events.emit`. Return the project.

4. `currentProject()`: `return requireProject(ctx)`. `recentProjects()`: `(await ctx.deps.settings.load()).recent`.

5. `templates()`: `const tfs = ctx.deps.openFs(ctx.deps.templatesDir)`; for each id of `["landing", "portfolio", "docs", "blank"]` when `await tfs.exists(`${id}/template.json`)`: parse that JSON and push `{ id, name, meta }` (copy exactly those three fields).

6. In `src/engine/studio/create-studio.ts` insert `import { createProjectGroup } from "./project-group.ts";` directly above `// @seam:imports` and `Object.assign(studio, createProjectGroup(ctx));` directly above `// @seam:groups`. Keep both anchors.

7. Create `tests/helpers/fixture.ts` with exactly this content:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Text files of tests/fixtures/northfield keyed by project-relative path. */
export function fixtureFiles(): Record<string, string> {
  const root = join("tests", "fixtures", "northfield");
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(root, full).replace(/\\/g, "/")] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return out;
}
```

8. Create `tests/engine/project-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

const templates = {
  "blank/template.json": '{ "id": "blank", "name": "Blank", "meta": "Empty folder" }',
  "landing/template.json": '{ "id": "landing", "name": "Landing page", "meta": "1 page" }',
};

describe("project group", () => {
  it("opens a project with pages, flags and breakpoints", async () => {
    const studio = createStudio(createTestDeps({ "/sites/north": fixtureFiles() }));
    const p = await studio.openProject("/sites/north");
    expect(p.name).toBe("north");
    expect(p.root).toBe("/sites/north");
    expect(p.pages).toEqual([
      { name: "Home", file: "index.html", title: "Northfield Coffee", stylesheets: ["tokens.css", "styles.css"] },
      { name: "Menu", file: "menu.html", title: "Menu", stylesheets: ["tokens.css", "styles.css"] },
    ]);
    expect([p.hasTokens, p.hasTaste, p.breakpoints.length]).toEqual([true, true, 3]);
    expect(await studio.currentProject()).toEqual(p);
  });
  it("rejects a folder without top-level html files", async () => {
    const studio = createStudio(createTestDeps({ "/empty": { "notes.txt": "x", "sub/page.html": "<p>x</p>" } }));
    await expect(studio.openProject("/empty")).rejects.toMatchObject({ code: "NOT_A_PROJECT" });
  });
  it("rejects currentProject before a project is open", async () => {
    await expect(createStudio(createTestDeps()).currentProject()).rejects.toMatchObject({ code: "NO_PROJECT" });
  });
  it("records recent projects newest first and emits project-opened", async () => {
    const deps = createTestDeps({ "/a": { "index.html": "<p>a</p>" }, "/b": { "index.html": "<p>b</p>" } });
    const studio = createStudio(deps);
    await studio.openProject("/a");
    await studio.openProject("/b");
    await studio.openProject("/a");
    expect((await studio.recentProjects()).map((r) => r.root)).toEqual(["/a", "/b"]);
    expect(deps.events.emitted.map((e) => e.type)).toEqual(["project-opened", "project-opened", "project-opened"]);
  });
  it("lists templates in the fixed order", async () => {
    const studio = createStudio(createTestDeps({}, templates));
    expect(await studio.templates()).toEqual([
      { id: "landing", name: "Landing page", meta: "1 page" },
      { id: "blank", name: "Blank", meta: "Empty folder" },
    ]);
  });
});
```

9. Run the gate (see Verify).

## Acceptance criteria

- WHEN a folder with top-level .html files is opened THE SYSTEM SHALL return its pages, flags and breakpoints. (test: "opens a project with pages, flags and breakpoints")
- IF the folder has no top-level .html file THEN THE SYSTEM SHALL reject with NOT_A_PROJECT. (test: "rejects a folder without top-level html files")
- WHEN projects are opened THE SYSTEM SHALL keep recent projects newest first, without duplicates, and emit project-opened. (test: "records recent projects newest first and emits project-opened")
- THE SYSTEM SHALL list templates in the order landing, portfolio, docs, blank. (test: "lists templates in the fixed order")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T010`.
The last line must be `GATE PASS T010`. On `GATE FAIL T010 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T010` prints `GATE PASS T010`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T010: Implement opening projects, recents and templates
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
