# C5: Phase 5 checkpoint: elements can be added, edited and moved

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C5 (checkpoint), phase 5 |
| Depends on | T045, T046, T047, T048, T049, T050, T051 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/html/edit.ts`, `src/engine/html/structure.ts`, `src/engine/studio/create-studio.ts`, `src/engine/studio/element-group.ts`, `src/ui/canvas/Canvas.tsx`, `src/ui/canvas/TextEditor.tsx`, `src/ui/canvas/canvas.css`, `src/ui/canvas/tools.ts`, `src/ui/panels/LayersTree.tsx`, `src/ui/state/create-store.ts`, `src/ui/state/element-actions.ts`, `tests/e2e/elements.spec.ts`, `tests/engine/element-group.test.ts`, `tests/engine/html-edit.test.ts`, `tests/engine/html-structure.test.ts`, `tests/ui/element-actions.test.ts`, `tests/ui/insert-tools.test.ts`, `tests/ui/layers-drag.test.tsx`, `tests/ui/text-editor.test.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C5`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test canvas.spec.ts design.spec.ts elements.spec.ts --project=chromium` -> exit 0, output contains `8 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T045-T046 | HTML planners: text, remove, insert, move, wrap |
| T047 | Element group |
| T048 | Store element actions |
| T049-T051 | Insert tools, in-place text editing, layer drag, elements smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C5`.
The last line must be `GATE PASS C5`. On `GATE FAIL C5 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C5` prints `GATE PASS C5`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C5: Phase 5 checkpoint: elements can be added, edited and moved
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
