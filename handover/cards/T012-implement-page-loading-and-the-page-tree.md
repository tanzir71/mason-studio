# T012: Implement page loading and the page tree

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T012 (build), phase 2 |
| Depends on | T006, T010 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R5, R6 |

**Create:** `src/engine/studio/page-group.ts`, `tests/engine/page-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T012`):

1. `npx vitest run tests/engine/page-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`pageTree(page)` returns the body tree, and `loadPage(ctx, page)` gives later groups the page HTML, model and parsed stylesheets.

## Context

Engine module, studio area. Every later group (inspect, style, elements, checks, proposals) calls `loadPage`. Registers itself in `create-studio.ts` (same module).

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
// src/contracts/engine.ts
export interface PageModel {
  file: string;
  title: string;            // <title> text trimmed, or file name without ".html" when missing/empty
  /** href of every <link rel="stylesheet"> that is relative (no scheme, not "/" or "//"), "?"/"#" parts and a leading "./" removed. */
  stylesheets: string[];
  body: ElementNode;        // path ""
  /** css-select `is(node, selector)` for the element at path (exceptions → false); null if path is missing. */
  matcher(path: ElementPath): ElementMatcher | null;
}
```

```ts
// src/contracts/model.ts
export interface PageInfo { name: string; file: string; title: string; stylesheets: string[] }
export interface CssSheet { file: string; text: string; rules: CssRule[]; mediaBlocks: CssMediaBlock[] }
```

## Current state

`src/engine/studio/create-studio.ts` has `import { createProjectGroup } from "./project-group.ts";` above `// @seam:imports` and `Object.assign(studio, createProjectGroup(ctx));` above `// @seam:groups`. `src/engine/css/parse.ts` exports `parseStylesheet`; `src/engine/html/parse.ts` exports `parsePage`.

## Steps

1. Create `src/engine/studio/page-group.ts` exporting:
```ts
export interface LoadedPage { info: PageInfo; html: string; model: PageModel; sheets: CssSheet[] }

/** requireProject + requireFs; page = project.pages.find((p) => p.name === name) or
 *  throw new MasonError("PAGE_NOT_FOUND", name); html = fs.readText(info.file); model = parsePage(info.file, html);
 *  sheets = for each href of model.stylesheets, in order, that fs.exists(href): parseStylesheet(href, await fs.readText(href)). */
export async function loadPage(ctx: EngineContext, name: string): Promise<LoadedPage>;

export function createPageGroup(ctx: EngineContext): Pick<StudioService, "pageTree">; // pageTree(page) → (await loadPage(ctx, page)).model.body
```

2. In `src/engine/studio/create-studio.ts` insert `import { createPageGroup } from "./page-group.ts";` directly above `// @seam:imports` and `Object.assign(studio, createPageGroup(ctx));` directly above `// @seam:groups`.

3. Create `tests/engine/page-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createEngineContext } from "../../src/engine/studio/context.ts";
import { createProjectGroup } from "../../src/engine/studio/project-group.ts";
import { loadPage } from "../../src/engine/studio/page-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("page group", () => {
  it("returns the body tree of a page", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    const body = await studio.pageTree("Home");
    expect(body.tag).toBe("body");
    expect(body.children.map((c) => c.name)).toEqual(["Header", "Main", "Footer"]);
  });
  it("rejects an unknown page with PAGE_NOT_FOUND", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.pageTree("Nope")).rejects.toMatchObject({ code: "PAGE_NOT_FOUND" });
  });
  it("loads the page with its existing stylesheets parsed in order", async () => {
    const files = fixtureFiles();
    delete files["tokens.css"];
    const ctx = createEngineContext(createTestDeps({ "/p": files }));
    await createProjectGroup(ctx).openProject("/p");
    const loaded = await loadPage(ctx, "Home");
    expect(loaded.info.file).toBe("index.html");
    expect(loaded.html.startsWith("<!doctype html>")).toBe(true);
    expect(loaded.sheets.map((s) => s.file)).toEqual(["styles.css"]);
    expect(loaded.sheets[0].rules.length).toBe(14);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN pageTree is called for an open page THE SYSTEM SHALL return its body tree. (test: "returns the body tree of a page")
- IF the page does not exist THEN THE SYSTEM SHALL reject with PAGE_NOT_FOUND. (test: "rejects an unknown page with PAGE_NOT_FOUND")
- THE SYSTEM SHALL parse only stylesheets that exist, in link order. (test: "loads the page with its existing stylesheets parsed in order")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T012`.
The last line must be `GATE PASS T012`. On `GATE FAIL T012 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T012` prints `GATE PASS T012`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T012: Implement page loading and the page tree
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
