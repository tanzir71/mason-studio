# T038: Implement the write pipeline with undo and redo

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T038 (build), phase 4 |
| Depends on | T035, T012 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R21 |

**Create:** `src/engine/studio/write.ts`, `tests/engine/write.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T038`):

1. `npx vitest run tests/engine/write.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`commitChanges` and `writeEdits` save file changes as one undo step with a new revision and a `written` event; `undo` and `redo` replay steps.

## Context

Engine module, studio area. Every later write (styles, elements, code, tokens, proposals) goes through `commitChanges`/`writeEdits`, so the message, revision and event rules live in one place. The FileSystem port cannot delete files, so undoing a step that created a file writes it back empty.

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
export interface WriteResult {
  files: string[];          // project-relative files written, sorted
  revision: number;         // increments by 1 on every successful write, undo or redo
  effective: boolean;       // true when the edited element now shows the requested value at the scope width
  path: ElementPath | null; // path of an inserted/moved/wrapped element, else null
  message: string;          // toast text, e.g. "Saved to styles.css"
}
export interface TextEdit { file: string; start: number; end: number; text: string }
export type MasonEvent =
  | { type: "written"; files: string[]; revision: number }
```

```ts
// src/engine/studio/context.ts (T002)
export interface HistoryStep { files: { path: string; before: string | null; after: string }[]; message: string }
// EngineContext has: deps, project, fs, undoStack, redoStack, revision, proposals
```

## Current state

`src/engine/studio/create-studio.ts` registers the project and page groups above `// @seam:groups`. `src/engine/css/edits.ts` exports `applyTextEdits`.

## Steps

1. Create `src/engine/studio/write.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { TextEdit, WriteResult } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { applyTextEdits } from "../css/edits.ts";
import { requireFs } from "./context.ts";
import type { EngineContext, HistoryStep } from "./context.ts";

export interface FileChange { path: string; after: string }
export interface CommitOptions { message?: string; path?: string | null; effective?: boolean }

function finish(ctx: EngineContext, files: string[], message: string, options: CommitOptions): WriteResult {
  ctx.revision += 1;
  const sorted = [...files].sort();
  ctx.deps.events.emit({ type: "written", files: sorted, revision: ctx.revision });
  return { files: sorted, revision: ctx.revision, effective: options.effective ?? true, path: options.path ?? null, message };
}

/**
 * Writes whole-file changes as ONE undo step: reads each file's current text (null when missing), writes `after`,
 * pushes { files, message } on undoStack, clears redoStack, revision + 1, emits written.
 * message defaults to `Saved to ${files sorted, joined ", "}`. Changes whose text is unchanged are skipped;
 * when nothing changes → MasonError("INVALID_INPUT", "Nothing changed.").
 */
export async function commitChanges(ctx: EngineContext, changes: FileChange[], options: CommitOptions = {}): Promise<WriteResult> {
  const fs = requireFs(ctx);
  const step: HistoryStep = { files: [], message: "" };
  for (const change of changes) {
    const before = (await fs.exists(change.path)) ? await fs.readText(change.path) : null;
    if (before === change.after) continue;
    step.files.push({ path: change.path, before, after: change.after });
  }
  if (step.files.length === 0) throw new MasonError("INVALID_INPUT", "Nothing changed.");
  for (const f of step.files) await fs.writeText(f.path, f.after);
  const names = step.files.map((f) => f.path).sort();
  step.message = options.message ?? `Saved to ${names.join(", ")}`;
  ctx.undoStack.push(step);
  ctx.redoStack = [];
  return finish(ctx, names, step.message, options);
}

/** Groups edits by file, applies them to the current text of each file and commits the result as one step. */
export async function writeEdits(ctx: EngineContext, edits: TextEdit[], options: CommitOptions = {}): Promise<WriteResult> {
  const fs = requireFs(ctx);
  const byFile = new Map<string, TextEdit[]>();
  for (const e of edits) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]);
  const changes: FileChange[] = [];
  for (const [file, fileEdits] of byFile) {
    const before = (await fs.exists(file)) ? await fs.readText(file) : "";
    changes.push({ path: file, after: applyTextEdits(before, fileEdits) });
  }
  return commitChanges(ctx, changes, options);
}

/** undo/redo. A file the step created (before === null) is written back as "" (the FileSystem port cannot delete). */
export function createHistoryGroup(ctx: EngineContext): Pick<StudioService, "undo" | "redo"> {
  return {
    async undo() {
      const fs = requireFs(ctx);
      const step = ctx.undoStack.pop();
      if (!step) throw new MasonError("NOTHING_TO_UNDO");
      for (const f of step.files) await fs.writeText(f.path, f.before ?? "");
      ctx.redoStack.push(step);
      return finish(ctx, step.files.map((f) => f.path), `Undid: ${step.message}`, {});
    },
    async redo() {
      const fs = requireFs(ctx);
      const step = ctx.redoStack.pop();
      if (!step) throw new MasonError("NOTHING_TO_REDO");
      for (const f of step.files) await fs.writeText(f.path, f.after);
      ctx.undoStack.push(step);
      return finish(ctx, step.files.map((f) => f.path), `Redid: ${step.message}`, {});
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createHistoryGroup } from "./write.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createHistoryGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/write.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createEngineContext } from "../../src/engine/studio/context.ts";
import { createProjectGroup } from "../../src/engine/studio/project-group.ts";
import { commitChanges, createHistoryGroup, writeEdits } from "../../src/engine/studio/write.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";

async function setup() {
  const deps = createTestDeps({ "/p": { "index.html": "<p>x</p>", "a.css": "a { color: red; }\n" } });
  const ctx = createEngineContext(deps);
  await createProjectGroup(ctx).openProject("/p");
  deps.events.emitted.length = 0;
  return { deps, ctx, fs: deps.openFs("/p"), history: createHistoryGroup(ctx) };
}

describe("write pipeline", () => {
  it("applies edits per file as one step and emits written", async () => {
    const { ctx, fs, deps } = await setup();
    const r = await writeEdits(ctx, [{ file: "a.css", start: 11, end: 14, text: "blue" }, { file: "b.css", start: 0, end: 0, text: "b {}\n" }]);
    expect(r).toEqual({ files: ["a.css", "b.css"], revision: 1, effective: true, path: null, message: "Saved to a.css, b.css" });
    expect(await fs.readText("a.css")).toBe("a { color: blue; }\n");
    expect(ctx.undoStack.length).toBe(1);
    expect(deps.events.emitted).toEqual([{ type: "written", files: ["a.css", "b.css"], revision: 1 }]);
  });
  it("undoes and redoes a step", async () => {
    const { ctx, fs, history } = await setup();
    await commitChanges(ctx, [{ path: "a.css", after: "a {}\n" }], { message: "Saved to a.css", path: "1" });
    const u = await history.undo();
    expect([u.message, u.revision, await fs.readText("a.css")]).toEqual(["Undid: Saved to a.css", 2, "a { color: red; }\n"]);
    const r = await history.redo();
    expect([r.message, r.revision, await fs.readText("a.css")]).toEqual(["Redid: Saved to a.css", 3, "a {}\n"]);
  });
  it("empties a created file on undo and clears redo on a new write", async () => {
    const { ctx, fs, history } = await setup();
    await commitChanges(ctx, [{ path: "new.css", after: "x {}\n" }]);
    await history.undo();
    expect(await fs.readText("new.css")).toBe("");
    await commitChanges(ctx, [{ path: "a.css", after: "z {}\n" }]);
    await expect(history.redo()).rejects.toMatchObject({ code: "NOTHING_TO_REDO" });
  });
  it("rejects undo with an empty history and writes that change nothing", async () => {
    const { ctx, history } = await setup();
    await expect(history.undo()).rejects.toMatchObject({ code: "NOTHING_TO_UNDO" });
    await expect(commitChanges(ctx, [{ path: "a.css", after: "a { color: red; }\n" }])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN edits are written THE SYSTEM SHALL save every touched file as one step, increase the revision by 1 and emit written with sorted files. (test: "applies edits per file as one step and emits written")
- WHEN undo then redo run THE SYSTEM SHALL restore the before and after texts with messages "Undid: …" and "Redid: …". (test: "undoes and redoes a step")
- IF the history is empty or nothing changes THEN THE SYSTEM SHALL reject with NOTHING_TO_UNDO or INVALID_INPUT. (test: "rejects undo with an empty history and writes that change nothing")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T038`.
The last line must be `GATE PASS T038`. On `GATE FAIL T038 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T038` prints `GATE PASS T038`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T038: Implement the write pipeline with undo and redo
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
