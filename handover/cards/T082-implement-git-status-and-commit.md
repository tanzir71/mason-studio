# T082: Implement Git status and commit

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T082 (build), phase 10 |
| Depends on | T010 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R34 |

**Create:** `src/engine/studio/git-group.ts`, `tests/engine/git-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T082`):

1. `npx vitest run tests/engine/git-group.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`gitStatus()` reports whether the project is a repository, its branch and changed files; `commit(message)` adds everything and commits.

## Context

Engine module, studio area. Mason never pushes or pulls; it only commits locally. Registers in `create-studio.ts`.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface GitStatus { isRepo: boolean; branch: string | null; changes: number; files: string[] }
```

```ts
// src/contracts/ports.ts
/** Runs `git <args>` in the project root. Never throws for a non-zero exit code. */
export interface GitRunner { run(args: string[]): Promise<GitResult> }
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
// src/contracts/fakes.ts (tests only)
/** Responses keyed by args.join(" "); unknown commands answer { code: 0, stdout: "", stderr: "" }. */
export class FakeGitRunner implements GitRunner { readonly calls: string[][]; constructor(responses?: Record<string, GitResult>) }
```

## Current state

`ctx.deps.openGit(root)` returns a GitRunner; `requireProject(ctx).root` is the open folder.

## Steps

1. Create `src/engine/studio/git-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { GitStatus } from "../../contracts/model.ts";
import type { GitRunner, StudioService } from "../../contracts/ports.ts";
import { requireProject } from "./context.ts";
import type { EngineContext } from "./context.ts";

/** Paths from `git status --porcelain=v1 -uall` lines ("XY path" or "XY old -> new"), quotes removed. */
export function parsePorcelain(stdout: string): string[] {
  return stdout.split("\n").filter((l) => l.length > 3).map((l) => {
    const rest = l.slice(3);
    const path = rest.includes(" -> ") ? rest.slice(rest.indexOf(" -> ") + 4) : rest;
    return path.replace(/^"(.*)"$/, "$1");
  });
}

/** First non-empty line of stderr, else of stdout, else "exit <code>". */
function failure(r: { code: number; stdout: string; stderr: string }): string {
  const line = (r.stderr || r.stdout).split("\n").map((s) => s.trim()).find(Boolean);
  return line ?? `exit ${r.code}`;
}

export async function statusOf(git: GitRunner): Promise<GitStatus> {
  const inside = await git.run(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return { isRepo: false, branch: null, changes: 0, files: [] };
  const branch = (await git.run(["branch", "--show-current"])).stdout.trim() || null;
  const files = parsePorcelain((await git.run(["status", "--porcelain=v1", "-uall"])).stdout);
  return { isRepo: true, branch, changes: files.length, files };
}

export function createGitGroup(ctx: EngineContext): Pick<StudioService, "gitStatus" | "commit"> {
  const git = () => ctx.deps.openGit(requireProject(ctx).root);
  return {
    gitStatus: () => statusOf(git()),
    async commit(message) {
      const text = message.trim();
      if (text === "") throw new MasonError("INVALID_INPUT", "The commit message is empty.");
      const g = git();
      if (!(await statusOf(g)).isRepo) throw new MasonError("GIT_FAILED", "This folder is not a Git repository.");
      const add = await g.run(["add", "-A"]);
      if (add.code !== 0) throw new MasonError("GIT_FAILED", failure(add));
      const commit = await g.run(["commit", "-m", text]);
      if (commit.code !== 0) throw new MasonError("GIT_FAILED", failure(commit));
      return statusOf(g);
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createGitGroup } from "./git-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createGitGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/git-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { parsePorcelain } from "../../src/engine/studio/git-group.ts";
import { createTestDeps, FakeGitRunner } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

const ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
async function setup(responses: ConstructorParameters<typeof FakeGitRunner>[0]) {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const git = new FakeGitRunner(responses);
  deps.gitByRoot.set("/p", git);
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, git };
}
const repo = { "rev-parse --is-inside-work-tree": ok("true\n"), "branch --show-current": ok("main\n"), "status --porcelain=v1 -uall": ok(" M styles.css\n?? about.html\nR  old.css -> new.css\n") };

describe("git group", () => {
  it("parses porcelain status lines", () => {
    expect(parsePorcelain(' M styles.css\n?? "a b.html"\nR  old.css -> new.css\n')).toEqual(["styles.css", "a b.html", "new.css"]);
  });
  it("reports branch and changed files", async () => {
    const { s } = await setup(repo);
    expect(await s.gitStatus()).toEqual({ isRepo: true, branch: "main", changes: 3, files: ["styles.css", "about.html", "new.css"] });
  });
  it("reports a folder that is not a repository", async () => {
    const { s } = await setup({ "rev-parse --is-inside-work-tree": { code: 128, stdout: "", stderr: "fatal: not a git repository" } });
    expect(await s.gitStatus()).toEqual({ isRepo: false, branch: null, changes: 0, files: [] });
    await expect(s.commit("x")).rejects.toMatchObject({ code: "GIT_FAILED", message: "Git command failed. This folder is not a Git repository." });
  });
  it("adds and commits with the message", async () => {
    const { s, git } = await setup(repo);
    await s.commit("  Tighter headline  ");
    expect(git.calls.filter((c) => c[0] === "add" || c[0] === "commit")).toEqual([["add", "-A"], ["commit", "-m", "Tighter headline"]]);
  });
  it("rejects an empty message and reports git errors", async () => {
    const { s } = await setup({ ...repo, "commit -m x": { code: 1, stdout: "nothing to commit, working tree clean\n", stderr: "" } });
    await expect(s.commit(" ")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.commit("x")).rejects.toMatchObject({ code: "GIT_FAILED", message: "Git command failed. nothing to commit, working tree clean" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL parse porcelain status lines including quoted names and renames. (test: "parses porcelain status lines")
- THE SYSTEM SHALL report a folder outside Git as isRepo false and refuse to commit there. (test: "reports a folder that is not a repository")
- WHEN committing THE SYSTEM SHALL run `git add -A` then `git commit -m <trimmed message>`; git errors become GIT_FAILED with git's first line. (test: "rejects an empty message and reports git errors")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T082`.
The last line must be `GATE PASS T082`. On `GATE FAIL T082 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T082` prints `GATE PASS T082`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T082: Implement Git status and commit
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
