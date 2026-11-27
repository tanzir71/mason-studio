# C12: Phase 12 checkpoint: everything, browser and desktop

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C12 (checkpoint), phase 12 |
| Depends on | T091, T092, T093, S008 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `electron-builder.yml`, `package-lock.json`, `package.json`, `src/desktop/build.ts`, `src/desktop/main.ts`, `src/desktop/preload.ts`, `src/desktop/window.ts`, `tests/desktop/build.test.ts`, `tests/desktop/package.test.ts`, `tests/desktop/preload.test.ts`, `tests/desktop/window.test.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C12`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `npx storybook build --quiet -o storybook-static` -> exit 0, output contains `build completed successfully`
4. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
5. `npx vite build` -> exit 0, output contains `built in`
6. `npx playwright test agent.spec.ts canvas.spec.ts checks.spec.ts code.spec.ts design.spec.ts elements.spec.ts site.spec.ts start.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `22 passed`, output does not contain `failed`
7. `node src/desktop/build.ts` -> exit 0, output contains `built dist/desktop`
8. `npx electron dist/desktop/main.mjs --smoke` -> exit 0, output contains `MASON SMOKE OK`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass. The final gate also builds the desktop bundle and runs the Electron smoke test.

## Phase summary

| Card | Delivered |
|---|---|
| T091 | Electron toolchain and packaging config |
| T092-T093 | Window rules, preload bridge, main process, bundler |
| S008 | Server composed in the desktop app; Electron smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C12`.
The last line must be `GATE PASS C12`. On `GATE FAIL C12 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C12` prints `GATE PASS C12`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C12: Phase 12 checkpoint: everything, browser and desktop
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
