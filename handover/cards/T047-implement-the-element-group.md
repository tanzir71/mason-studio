# T047: Implement the element group

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T047 (build), phase 5 |
| Depends on | T046, T038 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `src/engine/studio/element-group.ts`, `tests/engine/element-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T047`):

1. `npx vitest run tests/engine/element-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`insertElement`, `editText`, `removeElement`, `moveElement` and `wrapInStack` write HTML (and CSS) changes as single undo steps.

## Context

Engine module, studio area. Registers in `create-studio.ts` (same module). `pageCss` is exported for later groups.

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
export type InsertKind = "frame" | "rect" | "ellipse" | "text" | "image";
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
```

## Current state

`src/engine/studio/write.ts` exports `writeEdits(ctx, edits, { path })`. `src/engine/studio/page-group.ts` exports `loadPage` and `LoadedPage`.

## Steps

1. Create `src/engine/studio/element-group.ts` with exactly this content:

```ts
import type { StudioService } from "../../contracts/ports.ts";
import { planEditText, planRemoveElement } from "../html/edit.ts";
import { planInsertElement, planMoveElement, planWrapInStack } from "../html/structure.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import type { LoadedPage } from "./page-group.ts";
import { writeEdits } from "./write.ts";

/** { file, text } of the page's last linked stylesheet ("" when the file does not exist yet), or null without one. */
export async function pageCss(ctx: EngineContext, lp: LoadedPage): Promise<{ file: string; text: string } | null> {
  const file = lp.model.stylesheets[lp.model.stylesheets.length - 1];
  if (!file) return null;
  const fs = requireFs(ctx);
  return { file, text: (await fs.exists(file)) ? await fs.readText(file) : "" };
}

export function createElementGroup(ctx: EngineContext): Pick<StudioService,
  "insertElement" | "editText" | "removeElement" | "moveElement" | "wrapInStack"> {
  return {
    async insertElement(page, parentPath, index, kind) {
      const lp = await loadPage(ctx, page);
      const plan = planInsertElement(lp.model, lp.html, await pageCss(ctx, lp), parentPath, index, kind);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
    async editText(page, path, text) {
      const lp = await loadPage(ctx, page);
      return writeEdits(ctx, planEditText(lp.model, path, text), { path });
    },
    async removeElement(page, path) {
      const lp = await loadPage(ctx, page);
      return writeEdits(ctx, planRemoveElement(lp.model, lp.html, path));
    },
    async moveElement(page, path, toIndex) {
      const lp = await loadPage(ctx, page);
      const plan = planMoveElement(lp.model, lp.html, path, toIndex);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
    async wrapInStack(page, path) {
      const lp = await loadPage(ctx, page);
      const plan = planWrapInStack(lp.model, lp.html, await pageCss(ctx, lp), path);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createElementGroup } from "./element-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createElementGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/element-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}

describe("element group", () => {
  it("inserts an element into the page and its rule into the last stylesheet", async () => {
    const { s, fs } = await setup();
    const r = await s.insertElement("Home", "1.0.0", 4, "ellipse");
    expect(r).toMatchObject({ files: ["index.html", "styles.css"], path: "1.0.0.4", message: "Saved to index.html, styles.css" });
    expect(await fs.readText("index.html")).toContain('<div class="ellipse-1"></div>');
    expect(await fs.readText("styles.css")).toContain(".ellipse-1 {\n  width: 120px;");
    expect((await s.pageTree("Home")).children[1].children[0].children[0].children[4].name).toBe("Ellipse 1");
  });
  it("edits text, removes, moves and wraps, each as one undo step", async () => {
    const { s, fs } = await setup();
    await s.editText("Home", "1.0.0.1", "Fresh beans");
    expect((await s.moveElement("Home", "1.0.0.0", 1)).path).toBe("1.0.0.1");
    expect((await s.wrapInStack("Home", "1.0.0.3")).path).toBe("1.0.0.3");
    await s.removeElement("Home", "2");
    const html = await fs.readText("index.html");
    expect(html).toContain("Fresh beans");
    expect(html).not.toContain("<footer");
    await s.undo(); await s.undo(); await s.undo(); await s.undo();
    expect(await fs.readText("index.html")).toBe(fixtureFiles()["index.html"]);
  });
  it("rejects a move that changes nothing", async () => {
    const { s } = await setup();
    await expect(s.moveElement("Home", "1.0.0.1", 1)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN an element is inserted THE SYSTEM SHALL write index.html and styles.css in one step and return the new path. (test: "inserts an element into the page and its rule into the last stylesheet")
- THE SYSTEM SHALL record each element change as one undo step. (test: "edits text, removes, moves and wraps, each as one undo step")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T047`.
The last line must be `GATE PASS T047`. On `GATE FAIL T047 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T047` prints `GATE PASS T047`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T047: Implement the element group
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
