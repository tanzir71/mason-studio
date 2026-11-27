# C6: Phase 6 checkpoint: design tokens round-trip

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C6 (checkpoint), phase 6 |
| Depends on | T052, T053, T054, T055, T056, T057, T058 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/studio/create-studio.ts`, `src/engine/studio/tokens-group.ts`, `src/engine/tokens/dtcg.ts`, `src/engine/tokens/to-css.ts`, `src/engine/tokens/tokens-studio.ts`, `src/ui/components/Field.tsx`, `src/ui/panels/AssetsPanel.tsx`, `src/ui/panels/DesignPanel.tsx`, `src/ui/panels/LeftPanel.tsx`, `src/ui/panels/assets.css`, `src/ui/panels/token-options.ts`, `src/ui/state/asset-actions.ts`, `src/ui/state/create-store.ts`, `tests/e2e/tokens.spec.ts`, `tests/engine/tokens-css.test.ts`, `tests/engine/tokens-dtcg.test.ts`, `tests/engine/tokens-group.test.ts`, `tests/engine/tokens-studio.test.ts`, `tests/ui/asset-actions.test.ts`, `tests/ui/assets-panel.test.tsx`, `tests/ui/token-options.test.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C6`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test canvas.spec.ts design.spec.ts elements.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `10 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T052-T054 | DTCG read/write, Tokens Studio import, tokens.css |
| T055 | Tokens group |
| T056-T058 | Store actions, Assets panel, token suggestions, tokens smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C6`.
The last line must be `GATE PASS C6`. On `GATE FAIL C6 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C6` prints `GATE PASS C6`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C6: Phase 6 checkpoint: design tokens round-trip
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
