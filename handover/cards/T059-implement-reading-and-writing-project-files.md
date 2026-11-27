# T059: Implement reading and writing project files

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T059 (build), phase 7 |
| Depends on | T038, T010 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R27 |

**Create:** `src/engine/studio/files-group.ts`, `tests/engine/files-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T059`):

1. `npx vitest run tests/engine/files-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`readFile(path)` and `writeFile(path, text)` give the code drawer raw access to project files, with undo.

## Context

Engine module, studio area. Writing a top-level .html file re-scans pages so titles stay current. Registers in `create-studio.ts`.

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
export interface FileText { path: string; text: string }
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
```

## Current state

`src/engine/studio/write.ts` exports `commitChanges`; `src/engine/studio/project-group.ts` exports `scanPages`.

## Steps

1. Create `src/engine/studio/files-group.ts` with exactly this content:

```ts
import type { StudioService } from "../../contracts/ports.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { scanPages } from "./project-group.ts";
import { commitChanges } from "./write.ts";

/** "\\" → "/", leading "./" and "/" removed. The FileSystem still rejects ".." escapes. */
export function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

export function createFilesGroup(ctx: EngineContext): Pick<StudioService, "readFile" | "writeFile"> {
  return {
    async readFile(path) {
      const fs = requireFs(ctx);
      const clean = cleanPath(path);
      return { path: clean, text: await fs.readText(clean) };
    },
    async writeFile(path, text) {
      const fs = requireFs(ctx);
      const clean = cleanPath(path);
      const result = await commitChanges(ctx, [{ path: clean, after: text }]);
      if (!clean.includes("/") && clean.endsWith(".html") && ctx.project) ctx.project = { ...ctx.project, pages: await scanPages(fs) };
      return result;
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createFilesGroup } from "./files-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createFilesGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/files-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { cleanPath } from "../../src/engine/studio/files-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}

describe("files group", () => {
  it("cleans paths", () => {
    expect(cleanPath(".\\css\\a.css")).toBe("css/a.css");
    expect(cleanPath("./styles.css")).toBe("styles.css");
  });
  it("reads a project file", async () => {
    const { s } = await setup();
    const f = await s.readFile("./styles.css");
    expect(f.path).toBe("styles.css");
    expect(f.text).toBe(fixtureFiles()["styles.css"]);
    await expect(s.readFile("nope.css")).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    await expect(s.readFile("../x")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
  it("writes a file as one undo step and refreshes page titles", async () => {
    const { s, fs } = await setup();
    const html = fixtureFiles()["menu.html"].replace("<title>Menu</title>", "<title>Our menu</title>");
    const r = await s.writeFile("menu.html", html);
    expect(r).toMatchObject({ files: ["menu.html"], message: "Saved to menu.html" });
    expect((await s.currentProject()).pages[1].title).toBe("Our menu");
    await s.undo();
    expect(await fs.readText("menu.html")).toBe(fixtureFiles()["menu.html"]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL read project files by cleaned relative path and reject missing or escaping paths. (test: "reads a project file")
- WHEN a page file is written THE SYSTEM SHALL record one undo step and refresh page titles. (test: "writes a file as one undo step and refreshes page titles")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T059`.
The last line must be `GATE PASS T059`. On `GATE FAIL T059 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T059` prints `GATE PASS T059`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T059: Implement reading and writing project files
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
