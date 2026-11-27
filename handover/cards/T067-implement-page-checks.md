# T067: Implement page checks

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T067 (build), phase 8 |
| Depends on | T064, T066, T055 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R28, R29 |

**Create:** `src/engine/studio/checks-group.ts`, `tests/engine/checks-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T067`):

1. `npx vitest run tests/engine/checks-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`checks(page)` combines structure, raw color and taste findings (one blocked finding per ban at its first line) with the list of passed checks.

## Context

Engine module, studio area. Registers in `create-studio.ts`.

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
export interface CheckReport { page: string; findings: CheckFinding[]; passed: string[] }
export type Severity = "blocked" | "warning" | "info";
```

## Current state

`src/engine/studio/tokens-group.ts` exports `readTokens(ctx)`. `src/engine/studio/page-group.ts` exports `loadPage`. The checks modules exist under `src/engine/checks/`.

## Steps

1. Create `src/engine/studio/checks-group.ts` with exactly this content:

```ts
import type { CheckFinding, CheckReport, Severity } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { checkRawColors, checkPageStructure } from "../checks/structure.ts";
import { checkBans, parseTaste } from "../checks/taste.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import { readTokens } from "./tokens-group.ts";

export const TASTE_FILE = ".mason/taste.md";
const ORDER: Record<Severity, number> = { blocked: 0, warning: 1, info: 2 };

/** Blocked first, then warnings, then info; ties by id. */
export function sortFindings(findings: CheckFinding[]): CheckFinding[] {
  return [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createChecksGroup(ctx: EngineContext): Pick<StudioService, "checks"> {
  return {
    async checks(page): Promise<CheckReport> {
      const fs = requireFs(ctx);
      const { info, html, model, sheets } = await loadPage(ctx, page);
      const structure = checkPageStructure(model.body);
      const findings: CheckFinding[] = [...structure.findings];
      const passed = [...structure.passed];
      const raw = checkRawColors(sheets, (await readTokens(ctx)).tokens);
      findings.push(...raw);
      if (raw.length === 0) passed.push("Colors use tokens");
      if (await fs.exists(TASTE_FILE)) {
        const profile = parseTaste(await fs.readText(TASTE_FILE));
        const seen = new Set<string>();
        const files = [{ file: info.file, text: html }, ...sheets.map((s) => ({ file: s.file, text: s.text }))];
        for (const f of files) {
          f.text.split("\n").forEach((lineText, i) => {
            for (const hit of checkBans(profile, lineText, { file: f.file, line: i + 1, path: null })) {
              if (seen.has(hit.id)) continue;
              seen.add(hit.id);
              findings.push(hit);
            }
          });
        }
        if (seen.size === 0) passed.push("No hard bans matched");
        profile.invalid.forEach((bad, i) => findings.push({ id: `taste:invalid:${i}`, kind: "taste", severity: "info",
          title: `Invalid ${bad}`, detail: `Fix it in ${TASTE_FILE}.`, file: TASTE_FILE, line: null, path: null }));
      }
      return { page, findings: sortFindings(findings), passed };
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createChecksGroup } from "./checks-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createChecksGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/checks-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { sortFindings } from "../../src/engine/studio/checks-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import type { CheckFinding } from "../../src/contracts/model.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup(files = fixtureFiles()) {
  const deps = createTestDeps({ "/p": files });
  const s = createStudio(deps);
  await s.openProject("/p");
  return s;
}

describe("checks group", () => {
  it("sorts blocked, then warnings, then info", () => {
    const f = (id: string, severity: CheckFinding["severity"]) => ({ id, severity } as CheckFinding);
    expect(sortFindings([f("b", "info"), f("a", "warning"), f("c", "blocked"), f("a", "info")]).map((x) => x.id + x.severity)).toEqual(["cblocked", "awarning", "ainfo", "binfo"]);
  });
  it("reports raw colors, the invalid regex and what passed on the home page", async () => {
    const r = await (await setup()).checks("Home");
    expect(r.page).toBe("Home");
    expect(r.findings.filter((f) => f.kind === "tokens").length).toBe(5);
    expect(r.findings.find((f) => f.id === "taste:invalid:0")).toMatchObject({ severity: "info", title: "Invalid regex: ([", file: ".mason/taste.md" });
    expect(r.passed).toEqual(["Headings in order", "Images have alt text", "No hard bans matched"]);
  });
  it("blocks a hard ban once, at its first line", async () => {
    const files = fixtureFiles();
    files["styles.css"] += "\n.x { background: linear-gradient(red, blue); }\n.y { background: linear-gradient(red, blue); }\n";
    const r = await (await setup(files)).checks("Home");
    const bans = r.findings.filter((f) => f.kind === "taste" && f.severity === "blocked");
    expect(bans).toEqual([{ id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "styles.css", line: 67, path: null }]);
    expect(r.findings[0].id).toBe("taste:11");
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL sort findings blocked, warning, info, then by id. (test: "sorts blocked, then warnings, then info")
- THE SYSTEM SHALL report the fixture's raw colors, the invalid regex and the passed checks. (test: "reports raw colors, the invalid regex and what passed on the home page")
- WHEN a ban matches several lines THE SYSTEM SHALL report it once at the first line. (test: "blocks a hard ban once, at its first line")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T067`.
The last line must be `GATE PASS T067`. On `GATE FAIL T067 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T067` prints `GATE PASS T067`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T067: Implement page checks
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
