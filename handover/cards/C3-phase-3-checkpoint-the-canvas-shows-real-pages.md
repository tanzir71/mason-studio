# C3: Phase 3 checkpoint: the canvas shows real pages

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C3 (checkpoint), phase 3 |
| Depends on | T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029, T030, T031, T032, S005 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/studio/page-group.ts`, `src/ui/api/http-client.ts`, `src/ui/app/App.tsx`, `src/ui/app/Toast.tsx`, `src/ui/app/ToolDock.tsx`, `src/ui/app/TopBar.tsx`, `src/ui/app/Workspace.tsx`, `src/ui/app/app.css`, `src/ui/app/shortcuts.ts`, `src/ui/canvas/Board.tsx`, `src/ui/canvas/Canvas.tsx`, `src/ui/canvas/Overlay.tsx`, `src/ui/canvas/canvas.css`, `src/ui/canvas/dom-paths.ts`, `src/ui/canvas/tools.ts`, `src/ui/components/Button.stories.tsx`, `src/ui/components/Button.tsx`, `src/ui/components/Field.tsx`, `src/ui/components/Inputs.stories.tsx`, `src/ui/components/Tabs.tsx`, `src/ui/components/primitives.css`, `src/ui/main.tsx`, `src/ui/panels/LayersTree.tsx`, `src/ui/panels/LeftPanel.tsx`, `src/ui/panels/panels.css`, `src/ui/state/create-store.ts`, `src/ui/state/event-actions.ts`, `src/ui/state/project-actions.ts`, `src/ui/state/store-context.ts`, `src/ui/state/view-actions.ts`, `tests/e2e/canvas.spec.ts`, `tests/engine/create-page.test.ts`, `tests/ui/app.test.tsx`, `tests/ui/board.test.tsx`, `tests/ui/button.test.tsx`, `tests/ui/canvas.test.tsx`, `tests/ui/dock-shortcuts.test.tsx`, `tests/ui/dom-paths.test.ts`, `tests/ui/event-actions.test.ts`, `tests/ui/http-client.test.ts`, `tests/ui/inputs.test.tsx`, `tests/ui/layers-tree.test.tsx`, `tests/ui/left-panel.test.tsx`, `tests/ui/mount.test.tsx`, `tests/ui/overlay.test.tsx`, `tests/ui/store-context.test.ts`, `tests/ui/store-core.test.ts`, `tests/ui/top-bar.test.tsx`, `tests/ui/view-actions.test.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C3`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `npx storybook build --quiet -o storybook-static` -> exit 0, output contains `build completed successfully`
4. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
5. `npx vite build` -> exit 0, output contains `built in`
6. `npx playwright test canvas.spec.ts --project=chromium` -> exit 0, output contains `3 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T017 | createPage |
| T018 | HTTP client with event stream |
| T019-T021 | Store core, project, view and event actions |
| T022-T023 | Primitives with stories |
| T024-T027 | Boards, overlays, canvas |
| T028-T032 | Top bar, left panel, layers, dock, toast, shortcuts, app shell |
| S005 | Browser entry mounted; canvas smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C3`.
The last line must be `GATE PASS C3`. On `GATE FAIL C3 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C3` prints `GATE PASS C3`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C3: Phase 3 checkpoint: the canvas shows real pages
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
