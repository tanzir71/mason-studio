# C8: Phase 8 checkpoint: checks

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C8 (checkpoint), phase 8 |
| Depends on | T064, T065, T066, T067, T068, T069, T070 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/checks/color.ts`, `src/engine/checks/structure.ts`, `src/engine/checks/taste.ts`, `src/engine/studio/checks-group.ts`, `src/engine/studio/create-studio.ts`, `src/ui/canvas/contrast.ts`, `src/ui/panels/ChecksPanel.tsx`, `src/ui/panels/RightPanel.tsx`, `src/ui/panels/checks.css`, `src/ui/state/check-actions.ts`, `src/ui/state/create-store.ts`, `tests/e2e/checks.spec.ts`, `tests/engine/checks-group.test.ts`, `tests/engine/color.test.ts`, `tests/engine/structure-checks.test.ts`, `tests/engine/taste.test.ts`, `tests/ui/check-actions.test.ts`, `tests/ui/checks-panel.test.tsx`, `tests/ui/contrast.test.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C8`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test canvas.spec.ts checks.spec.ts code.spec.ts design.spec.ts elements.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `13 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T064-T066 | Taste bans, colors, structure and raw color checks |
| T067 | Checks group |
| T068-T070 | Store actions, contrast in boards, Checks panel, checks smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C8`.
The last line must be `GATE PASS C8`. On `GATE FAIL C8 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C8` prints `GATE PASS C8`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C8: Phase 8 checkpoint: checks
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
