# T071: Implement agent and app settings

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T071 (build), phase 9 |
| Depends on | T010 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R30 |

**Create:** `src/engine/studio/settings-group.ts`, `tests/engine/settings-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T071`):

1. `npx vitest run tests/engine/settings-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`settings()` returns settings without the API key (with `hasApiKey`), and `saveSettings()` validates and stores them, keeping the stored key when the new one is empty.

## Context

Engine module, studio area. The API key never leaves the server; `agentSettings(ctx)` gives engine code the real one. Registers in `create-studio.ts`.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface AgentSettings { baseUrl: string; model: string; apiKey: string }
export interface Settings { agent: AgentSettings; hasApiKey: boolean; mcpEnabled: boolean; theme: "dark" | "light" }
/** What SettingsStore persists. `settings.agent.apiKey` holds the real key here. */
export interface StoredSettings { settings: Settings; recent: RecentProject[] }
export const DEFAULT_SETTINGS: Settings = {
  agent: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b", apiKey: "" },
  hasApiKey: false, mcpEnabled: false, theme: "dark",
};
```

```ts
// src/contracts/ports.ts
/** Persists StoredSettings as JSON. load() returns { settings: DEFAULT_SETTINGS, recent: [] } when nothing is stored. */
export interface SettingsStore { load(): Promise<StoredSettings>; save(value: StoredSettings): Promise<void> }
/**
 * Everything the UI, HTTP and MCP layers can do. Implemented by createStudio (src/engine/studio/).
 * Every method rejects with MasonError on failure. Methods that need an open project reject with NO_PROJECT.
 * Every write records one undo step, increments the revision and emits { type: "written" }.
 */
export interface StudioService {
  /** Opens a folder containing at least one top-level .html file (else NOT_A_PROJECT); records it in recent projects; emits project-opened. */
  openProject(root: string): Promise<ProjectInfo>;
  /** Copies templates/<template>/ into root (must be missing or empty, else FOLDER_NOT_EMPTY), then openProject(root). */
  createProject(root: string, template: TemplateId): Promise<ProjectInfo>;
  currentProject(): Promise<ProjectInfo>;
  recentProjects(): Promise<RecentProject[]>;          // newest first, max 8
  templates(): Promise<TemplateInfo[]>;                 // order: landing, portfolio, docs, blank
  /** Creates `${slug}.html` from the first page's <head> with an empty <main>; PAGE_EXISTS when present. */
  createPage(name: string): Promise<PageInfo>;
  pageTree(page: string): Promise<ElementNode>;         // body node; PAGE_NOT_FOUND
  inspect(page: string, path: ElementPath): Promise<InspectResult>;
  applyStyle(change: StyleChange): Promise<WriteResult>;
  resetStyle(page: string, path: ElementPath, prop: string, scope: Scope): Promise<WriteResult>;
  insertElement(page: string, parentPath: ElementPath, index: number, kind: InsertKind): Promise<WriteResult>;
  editText(page: string, path: ElementPath, text: string): Promise<WriteResult>;
  removeElement(page: string, path: ElementPath): Promise<WriteResult>;
  moveElement(page: string, path: ElementPath, toIndex: number): Promise<WriteResult>;
  wrapInStack(page: string, path: ElementPath): Promise<WriteResult>;
  undo(): Promise<WriteResult>;                          // NOTHING_TO_UNDO
  redo(): Promise<WriteResult>;                          // NOTHING_TO_REDO
  readFile(path: string): Promise<FileText>;
  writeFile(path: string, text: string): Promise<WriteResult>;
  tokens(): Promise<TokenSet>;                           // tokens.json at the root, or { tokens: [], file: null }
  importTokens(format: TokenFormat, json: string): Promise<TokenSet>; // writes tokens.json (DTCG) and tokens.css
  exportTokens(): Promise<WriteResult>;                  // rewrites tokens.css from tokens.json
  checks(page: string): Promise<CheckReport>;
  gitStatus(): Promise<GitStatus>;
  commit(message: string): Promise<GitStatus>;           // empty message → INVALID_INPUT; failure → GIT_FAILED
  proposals(): Promise<Proposal[]>;                       // newest first
  propose(input: ProposalInput): Promise<Proposal>;      // validates, labels, taste-checks; emits { type: "proposal" }
  acceptProposal(id: string, includeBlocked: boolean): Promise<WriteResult>;
  rejectProposal(id: string): Promise<Proposal>;
  askAgent(input: AskInput): Promise<Proposal>;          // LLM → propose(); source = settings.agent.model
  settings(): Promise<Settings>;                          // agent.apiKey is always "" here; hasApiKey tells if one is stored
  saveSettings(settings: Settings): Promise<Settings>;   // agent.apiKey "" keeps the stored key
}
```

## Current state

`ctx.deps.settings` is a `SettingsStore`; `openProject` already stores recent projects in it.

## Steps

1. Create `src/engine/studio/settings-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { Settings } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import type { EngineContext } from "./context.ts";

/** The stored agent settings including the real API key (engine-internal; never sent to the UI). */
export async function agentSettings(ctx: EngineContext): Promise<Settings["agent"]> {
  return (await ctx.deps.settings.load()).settings.agent;
}

export function createSettingsGroup(ctx: EngineContext): Pick<StudioService, "settings" | "saveSettings"> {
  const group: Pick<StudioService, "settings" | "saveSettings"> = {
    async settings() {
      const { settings } = await ctx.deps.settings.load();
      return { ...settings, agent: { ...settings.agent, apiKey: "" }, hasApiKey: settings.agent.apiKey !== "" };
    },
    async saveSettings(next) {
      const baseUrl = next.agent.baseUrl.trim().replace(/\/+$/, "");
      if (!/^https?:\/\/\S+$/.test(baseUrl)) throw new MasonError("INVALID_INPUT", "The agent URL must start with http:// or https://.");
      if (next.agent.model.trim() === "") throw new MasonError("INVALID_INPUT", "The model name is empty.");
      if (next.theme !== "dark" && next.theme !== "light") throw new MasonError("INVALID_INPUT", next.theme);
      const stored = await ctx.deps.settings.load();
      const apiKey = next.agent.apiKey === "" ? stored.settings.agent.apiKey : next.agent.apiKey;
      stored.settings = { agent: { baseUrl, model: next.agent.model.trim(), apiKey }, hasApiKey: apiKey !== "", mcpEnabled: next.mcpEnabled === true, theme: next.theme };
      await ctx.deps.settings.save(stored);
      return group.settings();
    },
  };
  return group;
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createSettingsGroup } from "./settings-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createSettingsGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/settings-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";

describe("settings group", () => {
  it("never returns the stored API key", async () => {
    const deps = createTestDeps();
    deps.settings.value = { settings: { ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, apiKey: "sk-secret" } }, recent: [] };
    const s = await createStudio(deps).settings();
    expect(s.agent.apiKey).toBe("");
    expect(s.hasApiKey).toBe(true);
  });
  it("keeps the stored key when the new key is empty and trims the URL", async () => {
    const deps = createTestDeps();
    const studio = createStudio(deps);
    await studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { baseUrl: "https://api.example.com/v1/", model: "m1", apiKey: "sk-1" } });
    const saved = await studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true, theme: "light", agent: { baseUrl: "https://api.example.com/v1", model: " m2 ", apiKey: "" } });
    expect(deps.settings.value!.settings.agent).toEqual({ baseUrl: "https://api.example.com/v1", model: "m2", apiKey: "sk-1" });
    expect(saved).toEqual({ agent: { baseUrl: "https://api.example.com/v1", model: "m2", apiKey: "" }, hasApiKey: true, mcpEnabled: true, theme: "light" });
  });
  it("rejects a bad URL or an empty model", async () => {
    const studio = createStudio(createTestDeps());
    await expect(studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, baseUrl: "ftp://x" } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, model: " " } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL return settings with an empty apiKey and hasApiKey set from the stored key. (test: "never returns the stored API key")
- WHEN saved with an empty key THE SYSTEM SHALL keep the stored key and trim the URL and model. (test: "keeps the stored key when the new key is empty and trims the URL")
- IF the URL is not http(s) or the model is empty THEN THE SYSTEM SHALL reject with INVALID_INPUT. (test: "rejects a bad URL or an empty model")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T071`.
The last line must be `GATE PASS T071`. On `GATE FAIL T071 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T071` prints `GATE PASS T071`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T071: Implement agent and app settings
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
