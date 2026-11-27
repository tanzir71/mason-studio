# C7: Phase 7 checkpoint: inspect and code

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C7 (checkpoint), phase 7 |
| Depends on | T059, T060, T061, T062, T063 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/studio/create-studio.ts`, `src/engine/studio/files-group.ts`, `src/ui/app/Workspace.tsx`, `src/ui/code/CodeDrawer.tsx`, `src/ui/code/CodeEditor.tsx`, `src/ui/code/code.css`, `src/ui/panels/InspectPanel.tsx`, `src/ui/panels/RightPanel.tsx`, `src/ui/panels/inspect.css`, `src/ui/state/code-actions.ts`, `src/ui/state/create-store.ts`, `tests/e2e/code.spec.ts`, `tests/engine/files-group.test.ts`, `tests/ui/code-actions.test.ts`, `tests/ui/code-drawer.test.tsx`, `tests/ui/code-editor.test.tsx`, `tests/ui/inspect-panel.test.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C7`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test canvas.spec.ts code.spec.ts design.spec.ts elements.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `11 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T059 | Files group |
| T060 | Store code actions |
| T061 | Inspect panel |
| T062-T063 | CodeMirror editor, code drawer, code smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C7`.
The last line must be `GATE PASS C7`. On `GATE FAIL C7 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C7` prints `GATE PASS C7`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C7: Phase 7 checkpoint: inspect and code
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
