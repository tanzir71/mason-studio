# T011: Implement creating a project from a template

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T011 (build), phase 2 |
| Depends on | T010 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R8 |

**Create:** `tests/engine/create-project.test.ts`

**Modify:** `src/engine/studio/project-group.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T011`):

1. `npx vitest run tests/engine/create-project.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createProject(root, template)` copies a template into an empty folder and opens it.

## Context

Engine module, studio area. Extends the project group from T010 (same file). The start screen (phase 10) calls it.

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
export type TemplateId = "landing" | "portfolio" | "docs" | "blank";
```

## Current state

`src/engine/studio/project-group.ts` (T010) exports `createProjectGroup(ctx)` returning `{ openProject, currentProject, recentProjects, templates }` as an object literal, plus `scanPages` and `pageNameOf`.

## Steps

1. In `src/engine/studio/project-group.ts`, change the return type of `createProjectGroup` to `Pick<StudioService, "openProject" | "currentProject" | "recentProjects" | "templates" | "createProject">` and add `createProject(root, template)` to the returned object:
   - `template` not in `["landing", "portfolio", "docs", "blank"]` → throw `new MasonError("INVALID_INPUT", template)`.
   - `const target = ctx.deps.openFs(root)`; `(await target.list("")).length > 0` → throw `new MasonError("FOLDER_NOT_EMPTY", root)`.
   - `const tfs = ctx.deps.openFs(ctx.deps.templatesDir)`; for every `file` of `await tfs.list(template)` except `${template}/template.json`: `await target.writeBytes(file.slice(template.length + 1), await tfs.readBytes(file))`.
   - Return `await group.openProject(root)` where `group` is the object being returned (declare it as `const group = { ... }` and `return group`).

2. Create `tests/engine/create-project.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";

const templates = {
  "blank/template.json": '{ "id": "blank", "name": "Blank", "meta": "Empty folder" }',
  "blank/index.html": "<!doctype html><html><head><title>Untitled</title></head><body><main></main></body></html>",
  "blank/css/styles.css": "body { margin: 0; }",
};

describe("createProject", () => {
  it("copies the template without template.json and opens it", async () => {
    const deps = createTestDeps({}, templates);
    const p = await createStudio(deps).createProject("/new/site", "blank");
    expect(p.pages.map((x) => x.file)).toEqual(["index.html"]);
    expect(await deps.openFs("/new/site").list("")).toEqual(["css/styles.css", "index.html"]);
  });
  it("refuses a folder that is not empty", async () => {
    const studio = createStudio(createTestDeps({ "/busy": { "a.txt": "x" } }, templates));
    await expect(studio.createProject("/busy", "blank")).rejects.toMatchObject({ code: "FOLDER_NOT_EMPTY" });
  });
  it("refuses an unknown template", async () => {
    const studio = createStudio(createTestDeps({}, templates));
    await expect(studio.createProject("/x", "fancy" as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN a template is chosen for an empty folder THE SYSTEM SHALL copy every template file except template.json and open the project. (test: "copies the template without template.json and opens it")
- IF the folder is not empty THEN THE SYSTEM SHALL reject with FOLDER_NOT_EMPTY. (test: "refuses a folder that is not empty")
- IF the template id is unknown THEN THE SYSTEM SHALL reject with INVALID_INPUT. (test: "refuses an unknown template")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T011`.
The last line must be `GATE PASS T011`. On `GATE FAIL T011 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T011` prints `GATE PASS T011`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T011: Implement creating a project from a template
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
