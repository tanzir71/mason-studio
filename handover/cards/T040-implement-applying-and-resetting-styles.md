# T040: Implement applying and resetting styles

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T040 (build), phase 4 |
| Depends on | T036, T037, T038, T039 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19, R20 |

**Create:** `src/engine/studio/style-group.ts`, `tests/engine/style-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T040`):

1. `npx vitest run tests/engine/style-group.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`applyStyle` and `resetStyle` write planned CSS edits through the write pipeline; `planStyles` applies several changes in memory for later proposal cards.

## Context

Engine module, studio area. `planStyles` re-parses after each change so several changes to one file never conflict; proposals (phase 9) call it with many changes and commit once. Registers in `create-studio.ts`.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface StyleChange { page: string; path: ElementPath; prop: InspectProp; value: string; scope: Scope }
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
/** Breakpoint whose width is used to evaluate an edit scope. */
export const SCOPE_BREAKPOINT: Record<Scope, BreakpointId> = { all: "desktop", tablet: "tablet", mobile: "mobile" };
```

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

## Current state

`src/engine/studio/write.ts` exports `commitChanges`, `writeEdits`, `FileChange`. `src/engine/css/plan-style.ts` exports `planStyleEdit`; `src/engine/css/plan-reset.ts` exports `planResetOverride`.

## Steps

1. Create `src/engine/studio/style-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS, SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { ElementPath, InspectProp, Scope } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { resolveCascade } from "../css/cascade.ts";
import { applyTextEdits } from "../css/edits.ts";
import { parseStylesheet } from "../css/parse.ts";
import { planResetOverride } from "../css/plan-reset.ts";
import { planStyleEdit } from "../css/plan-style.ts";
import { elementSelector } from "../html/select.ts";
import { loadPage } from "./page-group.ts";
import { commitChanges, writeEdits } from "./write.ts";
import type { FileChange } from "./write.ts";
import type { EngineContext } from "./context.ts";

export interface PlannedStyle { path: ElementPath; prop: string; value: string; scope: Scope }
export interface StylePlan { changes: FileChange[]; effective: boolean[] }

/**
 * Applies several style changes to one page in memory, in order, re-parsing the stylesheets after each one.
 * defaultFile = the page's last stylesheet href (NO_STYLESHEET when the page links none); a linked file that does
 * not exist yet starts as "". effective[i] = the change's value (trimmed) now wins at its scope's width.
 * Returns the changed files only.
 */
export async function planStyles(ctx: EngineContext, page: string, items: PlannedStyle[]): Promise<StylePlan> {
  const { model, sheets } = await loadPage(ctx, page);
  const defaultFile = model.stylesheets[model.stylesheets.length - 1];
  if (!defaultFile) throw new MasonError("NO_STYLESHEET", page);
  const original = new Map(sheets.map((s) => [s.file, s.text]));
  const texts = new Map(original);
  if (!texts.has(defaultFile)) texts.set(defaultFile, "");
  const order = model.stylesheets.filter((f, i) => texts.has(f) && model.stylesheets.indexOf(f) === i);
  const parsed = () => order.map((f) => parseStylesheet(f, texts.get(f)!));
  const effective: boolean[] = [];
  for (const item of items) {
    if (!(INSPECT_PROPS as readonly string[]).includes(item.prop)) throw new MasonError("INVALID_INPUT", item.prop);
    const el = model.matcher(item.path);
    if (!el) throw new MasonError("ELEMENT_NOT_FOUND", item.path);
    const edits = planStyleEdit({
      sheets: parsed(), el, elementSelector: elementSelector(model.body, item.path),
      prop: item.prop, value: item.value, scope: item.scope, defaultFile,
    });
    for (const file of new Set(edits.map((e) => e.file))) texts.set(file, applyTextEdits(texts.get(file) ?? "", edits.filter((e) => e.file === file)));
    const width = BREAKPOINTS.find((b) => b.id === SCOPE_BREAKPOINT[item.scope])!.width;
    const win = resolveCascade(parsed(), el, item.prop, width).find((e) => e.winning);
    effective.push(win?.declaration.value === item.value.trim());
  }
  const changes = [...texts].filter(([file, text]) => original.get(file) !== text).map(([path, after]) => ({ path, after }));
  return { changes, effective };
}

export function createStyleGroup(ctx: EngineContext): Pick<StudioService, "applyStyle" | "resetStyle"> {
  return {
    async applyStyle(change) {
      const plan = await planStyles(ctx, change.page, [change]);
      return commitChanges(ctx, plan.changes, { effective: plan.effective[0] });
    },
    async resetStyle(page, path, prop, scope) {
      const { model, sheets } = await loadPage(ctx, page);
      const el = model.matcher(path);
      if (!el) throw new MasonError("ELEMENT_NOT_FOUND", path);
      const edits = planResetOverride({ sheets, el, prop: prop as InspectProp, scope });
      if (edits.length === 0) throw new MasonError("INVALID_INPUT", "No override to reset.");
      return writeEdits(ctx, edits);
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createStyleGroup } from "./style-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createStyleGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/style-group.test.ts` with exactly this content:

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

describe("style group", () => {
  it("writes a tablet override into styles.css and undoes it", async () => {
    const { s, fs } = await setup();
    const before = await fs.readText("styles.css");
    const r = await s.applyStyle({ page: "Home", path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" });
    expect(r).toEqual({ files: ["styles.css"], revision: 1, effective: true, path: null, message: "Saved to styles.css" });
    expect(await fs.readText("styles.css")).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
    expect((await s.inspect("Home", "1.0.0.1")).props["font-size"].values.tablet).toBe("30px");
    await s.undo();
    expect(await fs.readText("styles.css")).toBe(before);
  });
  it("reports effective false when another rule still wins", async () => {
    const { s, fs } = await setup();
    await fs.writeText("styles.css", (await fs.readText("styles.css")) + "\n#x, .hero .headline { color: red !important; }\n");
    const r = await s.applyStyle({ page: "Home", path: "1.0.0.1", prop: "color", value: "blue", scope: "mobile" });
    expect(r.effective).toBe(false);
  });
  it("resets a mobile override", async () => {
    const { s, fs } = await setup();
    await s.resetStyle("Home", "1.0.0.1", "font-size", "mobile");
    expect(await fs.readText("styles.css")).not.toContain("28px");
    expect((await s.inspect("Home", "1.0.0.1")).props["font-size"].values.mobile).toBe("32px");
  });
  it("rejects a reset with no override and pages without stylesheets", async () => {
    const { s } = await setup();
    await expect(s.resetStyle("Home", "1.0.0.2", "font-size", "tablet")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const bare = createStudio(createTestDeps({ "/b": { "index.html": "<html><head></head><body><p>x</p></body></html>" } }));
    await bare.openProject("/b");
    await expect(bare.applyStyle({ page: "Home", path: "0", prop: "color", value: "red", scope: "all" })).rejects.toMatchObject({ code: "NO_STYLESHEET" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN a tablet font size is applied THE SYSTEM SHALL write it inside the 768 media rule, report effective true, and undo restores the file. (test: "writes a tablet override into styles.css and undoes it")
- IF another rule still wins after the write THEN THE SYSTEM SHALL report effective false. (test: "reports effective false when another rule still wins")
- IF there is no override to reset or the page has no stylesheet THEN THE SYSTEM SHALL reject with INVALID_INPUT or NO_STYLESHEET. (test: "rejects a reset with no override and pages without stylesheets")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T040`.
The last line must be `GATE PASS T040`. On `GATE FAIL T040 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T040` prints `GATE PASS T040`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T040: Implement applying and resetting styles
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
