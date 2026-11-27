# T004: Implement the file settings store

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T004 (build), phase 2 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R2 |

**Create:** `tests/infra/settings.test.ts`

**Modify:** `src/server/infra/settings.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T004`):

1. `npx vitest run tests/infra/settings.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createFileSettingsStore(filePath)` persists StoredSettings as JSON with defaults for anything missing.

## Context

Infra module. Replaces the T002 stub. S002 runs the SettingsStore contract suite against it; the engine uses it for recent projects and agent settings.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/** Persists StoredSettings as JSON. load() returns { settings: DEFAULT_SETTINGS, recent: [] } when nothing is stored. */
export interface SettingsStore { load(): Promise<StoredSettings>; save(value: StoredSettings): Promise<void> }
/** src/server/infra/settings.ts — JSON file at filePath, written with mode 0o600. */
export type CreateFileSettingsStore = (filePath: string) => SettingsStore;
```

```ts
// src/contracts/model.ts
export interface Settings { agent: AgentSettings; hasApiKey: boolean; mcpEnabled: boolean; theme: "dark" | "light" }
/** What SettingsStore persists. `settings.agent.apiKey` holds the real key here. */
export interface StoredSettings { settings: Settings; recent: RecentProject[] }
export const DEFAULT_SETTINGS: Settings = {
  agent: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b", apiKey: "" },
  hasApiKey: false, mcpEnabled: false, theme: "dark",
};
```

## Current state

`src/server/infra/settings.ts` is a stub that throws NOT_IMPLEMENTED.

## Steps

1. Replace the whole content of `src/server/infra/settings.ts` with an implementation of `export const createFileSettingsStore: CreateFileSettingsStore = (filePath) => ({ load, save })` where:
   - `load()`: read the file as UTF-8 with `readFile` from `node:fs/promises`. On any read or `JSON.parse` error return `{ settings: structuredClone(DEFAULT_SETTINGS), recent: [] }`. Otherwise, with `parsed` the object, return `{ settings: { ...DEFAULT_SETTINGS, ...parsed.settings, agent: { ...DEFAULT_SETTINGS.agent, ...parsed.settings?.agent } }, recent: Array.isArray(parsed.recent) ? parsed.recent : [] }`.
   - `save(value)`: `mkdir(dirname(filePath), { recursive: true })`, then `writeFile(filePath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })`.
   - Import `DEFAULT_SETTINGS` as a value from `../../contracts/model.ts` and the types with `import type`.

2. Create `tests/infra/settings.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileSettingsStore } from "../../src/server/infra/settings.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";

describe("createFileSettingsStore", () => {
  it("returns defaults when the file holds invalid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    writeFileSync(join(dir, "settings.json"), "{nope");
    expect(await createFileSettingsStore(join(dir, "settings.json")).load()).toEqual({ settings: DEFAULT_SETTINGS, recent: [] });
    rmSync(dir, { recursive: true, force: true });
  });
  it("fills missing fields from the defaults", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ settings: { mcpEnabled: true, agent: { model: "m" } } }));
    const loaded = await createFileSettingsStore(join(dir, "settings.json")).load();
    expect(loaded.settings.mcpEnabled).toBe(true);
    expect(loaded.settings.agent).toEqual({ ...DEFAULT_SETTINGS.agent, model: "m" });
    expect(loaded.recent).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("writes pretty JSON and creates the folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    const file = join(dir, "nested", "settings.json");
    await createFileSettingsStore(file).save({ settings: DEFAULT_SETTINGS, recent: [] });
    expect(readFileSync(file, "utf8")).toBe(JSON.stringify({ settings: DEFAULT_SETTINGS, recent: [] }, null, 2) + "\n");
    rmSync(dir, { recursive: true, force: true });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- IF the settings file holds invalid JSON THEN THE SYSTEM SHALL load the defaults. (test: "returns defaults when the file holds invalid JSON")
- WHEN fields are missing THE SYSTEM SHALL fill them from DEFAULT_SETTINGS. (test: "fills missing fields from the defaults")
- WHEN save runs THE SYSTEM SHALL write 2-space JSON plus a newline, creating folders. (test: "writes pretty JSON and creates the folder")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T004`.
The last line must be `GATE PASS T004`. On `GATE FAIL T004 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T004` prints `GATE PASS T004`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T004: Implement the file settings store
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
