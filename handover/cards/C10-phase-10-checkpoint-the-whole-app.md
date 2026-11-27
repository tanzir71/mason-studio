# C10: Phase 10 checkpoint: the whole app

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C10 (checkpoint), phase 10 |
| Depends on | T081, T082, T083, T084, T085, T086, S007 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/studio/create-studio.ts`, `src/engine/studio/git-group.ts`, `src/server/infra/git.ts`, `src/server/infra/watcher.ts`, `src/server/start.ts`, `src/ui/app/App.tsx`, `src/ui/app/GitChip.tsx`, `src/ui/app/TopBar.tsx`, `src/ui/app/app.css`, `src/ui/start/StartScreen.tsx`, `src/ui/start/start.css`, `src/ui/state/create-store.ts`, `src/ui/state/git-actions.ts`, `src/ui/state/store-context.ts`, `tests/e2e/start.spec.ts`, `tests/engine/git-group.test.ts`, `tests/infra/git.test.ts`, `tests/infra/watcher.test.ts`, `tests/integration/watch.test.ts`, `tests/ui/git-actions.test.ts`, `tests/ui/git-chip.test.tsx`, `tests/ui/start-screen.test.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C10`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `npx storybook build --quiet -o storybook-static` -> exit 0, output contains `build completed successfully`
4. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
5. `npx vite build` -> exit 0, output contains `built in`
6. `npx playwright test agent.spec.ts canvas.spec.ts checks.spec.ts code.spec.ts design.spec.ts elements.spec.ts start.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `18 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T081-T084 | Git runner, status and commit, store actions, Git chip |
| T085 | Start screen |
| T086, S007 | Project watcher composed; start smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C10`.
The last line must be `GATE PASS C10`. On `GATE FAIL C10 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C10` prints `GATE PASS C10`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C10: Phase 10 checkpoint: the whole app
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
