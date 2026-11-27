# T055: Implement the tokens group

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T055 (build), phase 6 |
| Depends on | T053, T054, T038 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R25, R26 |

**Create:** `src/engine/studio/tokens-group.ts`, `tests/engine/tokens-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T055`):

1. `npx vitest run tests/engine/tokens-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`tokens`, `importTokens` and `exportTokens` read tokens.json, import DTCG or Tokens Studio files, and regenerate tokens.css.

## Context

Engine module, studio area. An import writes tokens.json (always DTCG) and tokens.css as one undo step. Registers in `create-studio.ts`.

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
export interface TokenSet { tokens: Token[]; file: string | null }
export type TokenFormat = "dtcg" | "tokens-studio";
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
```

## Current state

`src/engine/studio/write.ts` exports `commitChanges(ctx, changes, { message })`. The token modules exist under `src/engine/tokens/`.

## Steps

1. Create `src/engine/studio/tokens-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { TokenSet } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { parseDtcg, serializeDtcg } from "../tokens/dtcg.ts";
import { fromTokensStudio } from "../tokens/tokens-studio.ts";
import { tokensToCss } from "../tokens/to-css.ts";
import { requireFs, requireProject } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { commitChanges } from "./write.ts";

export const TOKENS_FILE = "tokens.json";
export const TOKENS_CSS = "tokens.css";

/** tokens.json parsed, or { tokens: [], file: null } when the project has none. */
export async function readTokens(ctx: EngineContext): Promise<TokenSet> {
  const fs = requireFs(ctx);
  if (!(await fs.exists(TOKENS_FILE))) return { tokens: [], file: null };
  return parseDtcg(await fs.readText(TOKENS_FILE), TOKENS_FILE);
}

export function createTokensGroup(ctx: EngineContext): Pick<StudioService, "tokens" | "importTokens" | "exportTokens"> {
  return {
    tokens: () => readTokens(ctx),
    async importTokens(format, json) {
      if (format !== "dtcg" && format !== "tokens-studio") throw new MasonError("INVALID_INPUT", format);
      const project = requireProject(ctx);
      const parsed = format === "dtcg" ? parseDtcg(json, TOKENS_FILE) : fromTokensStudio(json);
      const set: TokenSet = { tokens: parsed.tokens, file: TOKENS_FILE };
      const text = serializeDtcg(set);
      await commitChanges(ctx, [{ path: TOKENS_FILE, after: text }, { path: TOKENS_CSS, after: tokensToCss(set) }],
        { message: `Imported ${set.tokens.length} tokens` });
      ctx.project = { ...project, hasTokens: true };
      return parseDtcg(text, TOKENS_FILE);
    },
    async exportTokens() {
      const fs = requireFs(ctx);
      if (!(await fs.exists(TOKENS_FILE))) throw new MasonError("FILE_NOT_FOUND", TOKENS_FILE);
      const css = tokensToCss(await readTokens(ctx));
      const current = (await fs.exists(TOKENS_CSS)) ? await fs.readText(TOKENS_CSS) : null;
      if (current === css) return { files: [], revision: ctx.revision, effective: true, path: null, message: "tokens.css is up to date." };
      return commitChanges(ctx, [{ path: TOKENS_CSS, after: css }]);
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createTokensGroup } from "./tokens-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createTokensGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/tokens-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup(files = fixtureFiles()) {
  const deps = createTestDeps({ "/p": files });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}
const studioJson = JSON.stringify({ core: { color: { brand: { value: "#123456", type: "color" } } } });

describe("tokens group", () => {
  it("reads tokens.json, or an empty set without one", async () => {
    expect((await (await setup()).s.tokens()).tokens.length).toBe(8);
    const files = fixtureFiles();
    delete files["tokens.json"];
    expect(await (await setup(files)).s.tokens()).toEqual({ tokens: [], file: null });
  });
  it("imports Tokens Studio JSON into tokens.json and tokens.css as one undo step", async () => {
    const { s, fs } = await setup();
    const set = await s.importTokens("tokens-studio", studioJson);
    expect(set.tokens.map((t) => t.name)).toEqual(["color.brand"]);
    expect(await fs.readText("tokens.css")).toContain("--color-brand: #123456;");
    expect(JSON.parse(await fs.readText("tokens.json"))).toEqual({ color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [0.0706, 0.2039, 0.3373], hex: "#123456" } } } });
    await s.undo();
    expect(await fs.readText("tokens.css")).toBe(fixtureFiles()["tokens.css"]);
  });
  it("rewrites tokens.css from tokens.json and reports when it is up to date", async () => {
    const { s, fs } = await setup();
    expect((await s.exportTokens()).message).toBe("tokens.css is up to date.");
    await fs.writeText("tokens.css", "stale");
    const r = await s.exportTokens();
    expect(r).toMatchObject({ files: ["tokens.css"], message: "Saved to tokens.css" });
    expect(await fs.readText("tokens.css")).toBe(fixtureFiles()["tokens.css"]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN Tokens Studio JSON is imported THE SYSTEM SHALL write tokens.json as DTCG and tokens.css in one undo step. (test: "imports Tokens Studio JSON into tokens.json and tokens.css as one undo step")
- WHEN tokens.css is already current THE SYSTEM SHALL return no files with the message "tokens.css is up to date.". (test: "rewrites tokens.css from tokens.json and reports when it is up to date")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T055`.
The last line must be `GATE PASS T055`. On `GATE FAIL T055 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T055` prints `GATE PASS T055`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T055: Implement the tokens group
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
