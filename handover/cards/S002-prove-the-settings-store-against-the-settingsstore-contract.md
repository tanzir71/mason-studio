# S002: Prove the settings store against the SettingsStore contract

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S002 (seam), phase 2 |
| Depends on | T004, T010 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S002: infra -> engine (contract-test): createFileSettingsStore |
| Requirements | R2 |

**Create:** `tests/integration/settings.contract.test.ts`

**Modify:** none

**Read only:** `src/server/infra/settings.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S002`):

1. `npx vitest run tests/integration/settings.contract.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The shared SettingsStore contract suite passes against `createFileSettingsStore` on a temp file.

## Context

Seam infra → engine (contract-test). T004 built the store; the engine (T010 keeps recent projects in it) receives it through `StudioDeps.settings`, injected by S003.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/** Persists StoredSettings as JSON. load() returns { settings: DEFAULT_SETTINGS, recent: [] } when nothing is stored. */
export interface SettingsStore { load(): Promise<StoredSettings>; save(value: StoredSettings): Promise<void> }
```

```ts
// src/contracts/settings-store.contract.ts (protected; 3 tests)
export function runSettingsStoreContract(label: string, make: () => Promise<{ store: SettingsStore; cleanup(): Promise<void> }>): void;
```

## Touch list

### tests/integration/settings.contract.test.ts (create)

The complete file is given in the steps.

## Steps

1. Create `tests/integration/settings.contract.test.ts` with exactly this content:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSettingsStoreContract } from "../../src/contracts/settings-store.contract.ts";
import { createFileSettingsStore } from "../../src/server/infra/settings.ts";

runSettingsStoreContract("file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mason-settings-"));
  return { store: createFileSettingsStore(join(dir, "settings.json")), cleanup: async () => rmSync(dir, { recursive: true, force: true }) };
});
```

2. Run the gate (see Verify).

## Acceptance criteria

- WHEN the SettingsStore contract suite runs against createFileSettingsStore THE SYSTEM SHALL pass all 3 tests. (test: "saves and loads the same value")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S002`.
The last line must be `GATE PASS S002`. On `GATE FAIL S002 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S002 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S002` prints `GATE PASS S002`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S002: Prove the settings store against the SettingsStore contract
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
