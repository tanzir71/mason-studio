# C2: Phase 2 checkpoint: the backend serves a project

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C2 (checkpoint), phase 2 |
| Depends on | T003, S001, T004, S002, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, S003, T016, S004 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/cli/args.ts`, `src/cli/bin.ts`, `src/cli/open-browser.ts`, `src/engine/css/parse.ts`, `src/engine/html/names.ts`, `src/engine/html/parse.ts`, `src/engine/html/select.ts`, `src/engine/studio/create-studio.ts`, `src/engine/studio/page-group.ts`, `src/engine/studio/project-group.ts`, `src/server/http/events.ts`, `src/server/http/rpc.ts`, `src/server/http/server.ts`, `src/server/http/static.ts`, `src/server/infra/events.ts`, `src/server/infra/node-fs.ts`, `src/server/infra/settings.ts`, `src/server/start.ts`, `tests/cli/args.test.ts`, `tests/cli/bin.test.ts`, `tests/engine/create-project.test.ts`, `tests/engine/names.test.ts`, `tests/engine/page-group.test.ts`, `tests/engine/parse-css.test.ts`, `tests/engine/parse-page.test.ts`, `tests/engine/project-group.test.ts`, `tests/engine/select.test.ts`, `tests/helpers/fixture.ts`, `tests/helpers/http.ts`, `tests/http/events.test.ts`, `tests/http/rpc.test.ts`, `tests/http/server.test.ts`, `tests/http/static.test.ts`, `tests/infra/events.test.ts`, `tests/infra/node-fs.test.ts`, `tests/infra/settings.test.ts`, `tests/integration/node-fs.contract.test.ts`, `tests/integration/settings.contract.test.ts`, `tests/integration/start.test.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C2`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T003/S001 | Node file system, contract suite green |
| T004/S002 | Settings store, contract suite green |
| T005 | Event hub |
| T006 | Stylesheet parser with exact ranges |
| T007-T009 | Page parser, names, kinds, selectors |
| T010-T012 | Open/create projects, templates, page tree |
| T013-T015 | HTTP server: RPC, MCP route, static files, events |
| S003 | startMason composition |
| T016, S004 | mason command |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C2`.
The last line must be `GATE PASS C2`. On `GATE FAIL C2 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C2` prints `GATE PASS C2`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C2: Phase 2 checkpoint: the backend serves a project
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
