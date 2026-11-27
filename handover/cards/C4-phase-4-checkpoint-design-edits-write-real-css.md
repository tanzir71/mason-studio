# C4: Phase 4 checkpoint: design edits write real CSS

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C4 (checkpoint), phase 4 |
| Depends on | T033, T034, T035, T036, T037, T038, T039, T040, T041, T042, T043, T044 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/css/cascade.ts`, `src/engine/css/edits.ts`, `src/engine/css/media.ts`, `src/engine/css/plan-reset.ts`, `src/engine/css/plan-style.ts`, `src/engine/studio/create-studio.ts`, `src/engine/studio/inspect-group.ts`, `src/engine/studio/style-group.ts`, `src/engine/studio/write.ts`, `src/types/bramus-specificity.d.ts`, `src/ui/app/Workspace.tsx`, `src/ui/panels/DesignPanel.tsx`, `src/ui/panels/RightPanel.tsx`, `src/ui/panels/ScopeControl.tsx`, `src/ui/panels/design-fields.ts`, `src/ui/panels/design.css`, `src/ui/state/create-store.ts`, `src/ui/state/write-actions.ts`, `tests/e2e/design.spec.ts`, `tests/engine/cascade.test.ts`, `tests/engine/edits.test.ts`, `tests/engine/inspect-group.test.ts`, `tests/engine/media.test.ts`, `tests/engine/plan-reset.test.ts`, `tests/engine/plan-style.test.ts`, `tests/engine/style-group.test.ts`, `tests/engine/write.test.ts`, `tests/ui/design-fields.test.tsx`, `tests/ui/design-panel.test.tsx`, `tests/ui/right-panel.test.tsx`, `tests/ui/write-actions.test.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C4`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test canvas.spec.ts design.spec.ts --project=chromium` -> exit 0, output contains `5 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T033-T035 | Media, specificity, cascade, text edits |
| T036-T037 | Style edit and reset planners |
| T038-T040 | Write pipeline, undo/redo, inspect, style group |
| T041 | Store write actions |
| T042-T044 | Design panel with scope switch, right panel, design smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C4`.
The last line must be `GATE PASS C4`. On `GATE FAIL C4 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C4` prints `GATE PASS C4`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C4: Phase 4 checkpoint: design edits write real CSS
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
