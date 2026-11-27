# T017: Implement creating a page

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T017 (build), phase 3 |
| Depends on | T012 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R7 |

**Create:** `tests/engine/create-page.test.ts`

**Modify:** `src/engine/studio/page-group.ts`

**Read only:** `src/engine/studio/project-group.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T017`):

1. `npx vitest run tests/engine/create-page.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createPage(name)` writes `<slug>.html` from the first page's head with an empty `<main>` and refreshes the project's pages.

## Context

Engine module, studio area. The Pages list "+" button (T030) calls it through the store. `createPageGroup` already exists in `page-group.ts` and is registered in `create-studio.ts`, so no registration change is needed.

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
export interface PageInfo { name: string; file: string; title: string; stylesheets: string[] }
```

## Current state

`src/engine/studio/page-group.ts` (T012) ends with:

```ts
export function createPageGroup(ctx: EngineContext): Pick<StudioService, "pageTree"> {
  return { async pageTree(page) { return (await loadPage(ctx, page)).model.body; } };
}
```

`src/engine/studio/project-group.ts` exports `scanPages(fs: FileSystem): Promise<PageInfo[]>`.

## Steps

1. In `src/engine/studio/page-group.ts`, add `import { scanPages } from "./project-group.ts";` directly below the line `import { requireFs, requireProject } from "./context.ts";`.

2. Replace the whole `createPageGroup` function shown under Current state with exactly:

```ts
/** "About us!" → "about-us": lowercase, runs of characters outside a-z and 0-9 → "-", trim "-". */
export function pageSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createPageGroup(ctx: EngineContext): Pick<StudioService, "pageTree" | "createPage"> {
  return {
    async pageTree(page) { return (await loadPage(ctx, page)).model.body; },
    async createPage(name) {
      const project = requireProject(ctx); const fs = requireFs(ctx);
      const slug = pageSlug(name);
      if (slug === "") throw new MasonError("INVALID_INPUT", name);
      const file = `${slug}.html`;
      if (await fs.exists(file)) throw new MasonError("PAGE_EXISTS", file);
      const first = await fs.readText(project.pages[0].file);
      const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(first)?.[1] ?? "\n  <meta charset=\"utf-8\">\n  <title></title>\n";
      const title = `<title>${escapeHtml(name.trim())}</title>`;
      const newHead = /<title>[\s\S]*?<\/title>/i.test(head) ? head.replace(/<title>[\s\S]*?<\/title>/i, title) : head + `  ${title}\n`;
      await fs.writeText(file, `<!doctype html>\n<html lang="en">\n<head>${newHead}</head>\n<body>\n  <main></main>\n</body>\n</html>\n`);
      const pages = await scanPages(fs);
      ctx.project = { ...project, pages };
      return pages.find((p) => p.file === file)!;
    },
  };
}
```

3. Create `tests/engine/create-page.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { pageSlug } from "../../src/engine/studio/page-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("createPage", () => {
  it("slugs page names", () => {
    expect(pageSlug("About us!")).toBe("about-us");
    expect(pageSlug("  Wholesale ")).toBe("wholesale");
    expect(pageSlug("!!")).toBe("");
  });
  it("creates the file from the first page's head with an empty main", async () => {
    const deps = createTestDeps({ "/p": fixtureFiles() });
    const studio = createStudio(deps);
    await studio.openProject("/p");
    const info = await studio.createPage("Wholesale");
    expect(info).toEqual({ name: "Wholesale", file: "wholesale.html", title: "Wholesale", stylesheets: ["tokens.css", "styles.css"] });
    const html = await deps.openFs("/p").readText("wholesale.html");
    expect(html).toContain("<title>Wholesale</title>");
    expect(html).toContain("<body>\n  <main></main>\n</body>");
    expect((await studio.currentProject()).pages.map((p) => p.name)).toEqual(["Home", "Menu", "Wholesale"]);
  });
  it("rejects an existing page and an empty slug", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.createPage("menu")).rejects.toMatchObject({ code: "PAGE_EXISTS" });
    await expect(studio.createPage("???")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL slug page names to lowercase a-z/0-9 runs joined by "-". (test: "slugs page names")
- WHEN a page is created THE SYSTEM SHALL copy the first page's head, set the title, write an empty main and add the page to the project. (test: "creates the file from the first page's head with an empty main")
- IF the file exists or the slug is empty THEN THE SYSTEM SHALL reject with PAGE_EXISTS or INVALID_INPUT. (test: "rejects an existing page and an empty slug")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T017`.
The last line must be `GATE PASS T017`. On `GATE FAIL T017 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T017` prints `GATE PASS T017`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T017: Implement creating a page
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
