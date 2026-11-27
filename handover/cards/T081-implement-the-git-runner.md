# T081: Implement the Git runner

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T081 (build), phase 10 |
| Depends on | C1 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R34 |

**Create:** `tests/infra/git.test.ts`

**Modify:** `src/server/infra/git.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T081`):

1. `npx vitest run tests/infra/git.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createNodeGitRunner(root)` runs `git <args>` in the project folder and always resolves with the exit code and output.

## Context

Infra module. Replaces the T002 stub. `startMason` (S003) already passes it to the studio as `openGit`.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface GitResult { code: number; stdout: string; stderr: string }
/** Runs `git <args>` in the project root. Never throws for a non-zero exit code. */
export interface GitRunner { run(args: string[]): Promise<GitResult> }
/** src/server/infra/git.ts */
export type CreateNodeGitRunner = (root: string) => GitRunner;
```

## Current state

`src/server/infra/git.ts` is a stub that throws NOT_IMPLEMENTED. Git is installed (TASK-GRAPH requires it).

## Steps

1. Replace the whole content of `src/server/infra/git.ts` with exactly:

```ts
import { spawn } from "node:child_process";
import type { CreateNodeGitRunner, GitResult } from "../../contracts/ports.ts";

/** Runs `git <args>` in root. Never throws: a missing git binary gives code 127 with the error message in stderr. */
export const createNodeGitRunner: CreateNodeGitRunner = (root) => ({
  run(args: string[]): Promise<GitResult> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let child;
      try {
        child = spawn("git", args, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, windowsHide: true });
      } catch (error) {
        resolve({ code: 127, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
        return;
      }
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (c: string) => { stdout += c; });
      child.stderr.on("data", (c: string) => { stderr += c; });
      child.on("error", (error) => resolve({ code: 127, stdout, stderr: error.message }));
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
  },
});
```

2. Create `tests/infra/git.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeGitRunner } from "../../src/server/infra/git.ts";

describe("createNodeGitRunner", () => {
  it("runs git in the project folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-git-"));
    const git = createNodeGitRunner(dir);
    expect((await git.run(["init", "-q"])).code).toBe(0);
    writeFileSync(join(dir, "index.html"), "<p>x</p>");
    const status = await git.run(["status", "--porcelain=v1", "-uall"]);
    expect([status.code, status.stdout]).toEqual([0, "?? index.html\n"]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("returns a non-zero code instead of throwing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-git-"));
    const r = await createNodeGitRunner(dir).run(["rev-parse", "--is-inside-work-tree"]);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("not a git repository");
    rmSync(dir, { recursive: true, force: true });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL run git in the root folder and return code, stdout and stderr. (test: "runs git in the project folder")
- IF git fails THEN THE SYSTEM SHALL resolve with the non-zero code instead of throwing. (test: "returns a non-zero code instead of throwing")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T081`.
The last line must be `GATE PASS T081`. On `GATE FAIL T081 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T081` prints `GATE PASS T081`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T081: Implement the Git runner
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
