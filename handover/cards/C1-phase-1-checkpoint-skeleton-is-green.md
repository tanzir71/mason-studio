# C1: Phase 1 checkpoint: skeleton is green

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C1 (checkpoint), phase 1 |
| Depends on | T001, T002 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `.gitignore`, `.storybook/main.ts`, `.storybook/preview.ts`, `package-lock.json`, `package.json`, `playwright.config.ts`, `src/engine/studio/context.ts`, `src/engine/studio/create-studio.ts`, `src/server/http/server.ts`, `src/server/infra/events.ts`, `src/server/infra/git.ts`, `src/server/infra/llm.ts`, `src/server/infra/node-fs.ts`, `src/server/infra/settings.ts`, `src/server/infra/watcher.ts`, `src/server/mcp/handler.ts`, `src/server/start.ts`, `src/ui/api/http-client.ts`, `src/ui/app/App.tsx`, `src/ui/index.html`, `src/ui/main.tsx`, `src/ui/state/create-store.ts`, `src/ui/styles/global.css`, `tests/contracts.test.ts`, `tests/e2e/prepare.ts`, `tests/setup-dom.ts`, `tests/skeleton-ui.test.tsx`, `tests/skeleton.test.ts`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C1`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T001 | Pinned toolchain, configs, contract suites green |
| T002 | Stubs for every entry point, composition anchors, skeleton tests |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C1`.
The last line must be `GATE PASS C1`. On `GATE FAIL C1 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C1` prints `GATE PASS C1`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C1: Phase 1 checkpoint: skeleton is green
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
