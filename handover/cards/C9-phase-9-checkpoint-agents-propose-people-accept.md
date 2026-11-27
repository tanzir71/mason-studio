# C9: Phase 9 checkpoint: agents propose, people accept

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | C9 (checkpoint), phase 9 |
| Depends on | T071, T072, T073, T074, T075, T076, S006, T077, T078, T079, T080 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |

**Create:** none

**Modify:** `src/engine/studio/agent-group.ts`, `src/engine/studio/create-studio.ts`, `src/engine/studio/proposal-group.ts`, `src/engine/studio/settings-group.ts`, `src/server/infra/llm.ts`, `src/server/mcp/handler.ts`, `src/server/mcp/tools.ts`, `src/server/start.ts`, `src/ui/agent/AgentPrompt.tsx`, `src/ui/agent/ReviewCard.tsx`, `src/ui/agent/SettingsDialog.tsx`, `src/ui/agent/agent.css`, `src/ui/app/Workspace.tsx`, `src/ui/state/agent-actions.ts`, `src/ui/state/create-store.ts`, `tests/e2e/agent.spec.ts`, `tests/engine/agent-group.test.ts`, `tests/engine/proposal-group.test.ts`, `tests/engine/settings-group.test.ts`, `tests/infra/llm.test.ts`, `tests/integration/mcp.test.ts`, `tests/mcp/handler.test.ts`, `tests/mcp/tools.test.ts`, `tests/ui/agent-actions.test.ts`, `tests/ui/agent-prompt.test.tsx`, `tests/ui/review-card.test.tsx`, `tests/ui/settings-dialog.test.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C9`):

1. `npx vitest run` -> exit 0, output contains ` passed (`, output does not contain `failed`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test agent.spec.ts canvas.spec.ts checks.spec.ts code.spec.ts design.spec.ts elements.spec.ts tokens.spec.ts --project=chromium` -> exit 0, output contains `15 passed`, output does not contain `failed`
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full unit suite, the type check and this phase's smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T071 | Settings |
| T072 | Proposals |
| T073-T074 | LLM client, ask agent |
| T075-T076, S006 | MCP tools and handler, composed |
| T077-T080 | Store actions, review card, prompt, settings dialog, agent smoke test |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C9`.
The last line must be `GATE PASS C9`. On `GATE FAIL C9 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Allowed fixes

If a gate fails, fix code only inside the files listed under Modify in the scope block (the files this phase created or changed), and only to make an existing test pass as written. If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, fixtures, templates, `package.json` or `package-lock.json`.

## Done when

- `verify.ps1 -Card C9` prints `GATE PASS C9`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C9: Phase 9 checkpoint: agents propose, people accept
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
