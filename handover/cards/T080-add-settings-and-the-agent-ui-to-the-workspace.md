# T080: Add settings and the agent UI to the workspace

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T080 (build), phase 9 |
| Depends on | T079, S006, T063, T070 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R30, R31, R33 |

**Create:** `src/ui/agent/SettingsDialog.tsx`, `tests/e2e/agent.spec.ts`, `tests/ui/settings-dialog.test.tsx`

**Modify:** `src/ui/app/Workspace.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T080`):

1. `npx vitest run tests/ui/settings-dialog.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx vitest run tests/ui/app.test.tsx tests/ui/code-drawer.test.tsx` -> exit 0, output contains `Tests  8 passed (8)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test agent.spec.ts --project=chromium` -> exit 0, output contains `2 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The settings dialog edits the agent endpoint, model, key, MCP switch and theme; the workspace shows the review card, prompt and dialog; the phase 9 smoke test runs a full MCP review.

## Context

UI module, agent and app areas. This card also adds the phase 9 Playwright smoke spec: an agent proposes over HTTP MCP, a person accepts in the review card, then undoes. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface Settings { agent: AgentSettings; hasApiKey: boolean; mcpEnabled: boolean; theme: "dark" | "light" }
export const DEFAULT_SETTINGS: Settings = {
  agent: { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5-coder:7b", apiKey: "" },
  hasApiKey: false, mcpEnabled: false, theme: "dark",
};
```

```tsx
// src/contracts/ui.tsx
/** data-testid values. Board ids: `${TEST_IDS.board}${pageName}-${breakpointId}`. */
export const TEST_IDS = {
  startScreen: "start-screen", topBar: "top-bar", breakpointStrip: "breakpoint-strip", gitChip: "git-chip",
  leftPanel: "left-panel", pagesList: "pages-list", layersTree: "layers-tree", assetsPanel: "assets-panel",
  canvas: "canvas", board: "board-", selection: "overlay-selection", mirror: "overlay-mirror", toolDock: "tool-dock",
  rightPanel: "right-panel", designPanel: "design-panel", scopeControl: "scope-control", inspectPanel: "inspect-panel",
  checksPanel: "checks-panel", codeDrawer: "code-drawer", toast: "toast", reviewCard: "review-card",
  agentPrompt: "agent-prompt", settingsDialog: "settings-dialog",
} as const;
```

## Current state

`src/ui/app/Workspace.tsx` (T063) renders Canvas, ToolDock, Toast and CodeDrawer inside the stage.

## Steps

1. Create `src/ui/agent/SettingsDialog.tsx` with exactly this content:

```tsx
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../contracts/model.ts";
import type { Settings } from "../../contracts/model.ts";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import { Tabs } from "../components/Tabs.tsx";
import "./agent.css";

/** Agent endpoint, model, API key, MCP switch and theme. An empty API key field keeps the stored key. */
export function SettingsDialog() {
  const actions = useActions();
  const open = useStudio((s) => s.settingsOpen);
  const settings = useStudio((s) => s.settings);
  const [draft, setDraft] = useState<Settings>(settings ?? DEFAULT_SETTINGS);
  useEffect(() => { if (open) setDraft(settings ?? DEFAULT_SETTINGS); }, [open, settings]);
  if (!open) return null;
  const agent = (patch: Partial<Settings["agent"]>) => setDraft({ ...draft, agent: { ...draft.agent, ...patch } });
  const mcpUrl = `${window.location.origin}/mcp`;
  return (
    <div className="m-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) actions.closeSettings(); }}>
      <div className="m-dialog" role="dialog" aria-modal="true" aria-labelledby="m-settings-title" data-testid={TEST_IDS.settingsDialog}
        onKeyDown={(e) => { if (e.key === "Escape") actions.closeSettings(); }}>
        <header className="m-dialog__head"><h2 className="m-dialog__title" id="m-settings-title">Settings</h2></header>
        <div className="m-dialog__body">
          <label className="m-dialog__row">Agent endpoint
            <input className="m-input" value={draft.agent.baseUrl} onChange={(e) => agent({ baseUrl: e.target.value })} />
            <span className="m-dialog__hint">Any OpenAI-compatible API. Ollama and LM Studio run locally.</span>
          </label>
          <label className="m-dialog__row">Model
            <input className="m-input" value={draft.agent.model} onChange={(e) => agent({ model: e.target.value })} />
          </label>
          <label className="m-dialog__row">API key
            <input className="m-input" type="password" autoComplete="off" value={draft.agent.apiKey}
              placeholder={settings?.hasApiKey ? "Saved. Type to replace it." : "Not needed for local models"}
              onChange={(e) => agent({ apiKey: e.target.value })} />
          </label>
          <label className="m-dialog__check">
            <input type="checkbox" checked={draft.mcpEnabled} onChange={(e) => setDraft({ ...draft, mcpEnabled: e.target.checked })} />
            Let MCP agents read pages and propose changes
          </label>
          <span className="m-dialog__hint">{`MCP endpoint: ${mcpUrl}`}</span>
          <div className="m-dialog__row">Theme
            <Tabs<Settings["theme"]> variant="segmented" label="Theme" value={draft.theme} onChange={(theme) => setDraft({ ...draft, theme })}
              items={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]} />
          </div>
        </div>
        <footer className="m-dialog__foot">
          <Button variant="ghost" onClick={() => actions.closeSettings()}>Cancel</Button>
          <Button variant="primary" onClick={() => { void actions.saveSettings(draft); }}>Save</Button>
        </footer>
      </div>
    </div>
  );
}
```

2. Replace the whole content of `src/ui/app/Workspace.tsx` with exactly:

```tsx
import { Canvas } from "../canvas/Canvas.tsx";
import { CodeDrawer } from "../code/CodeDrawer.tsx";
import { AgentPrompt } from "../agent/AgentPrompt.tsx";
import { ReviewCard } from "../agent/ReviewCard.tsx";
import { SettingsDialog } from "../agent/SettingsDialog.tsx";
import { LeftPanel } from "../panels/LeftPanel.tsx";
import { RightPanel } from "../panels/RightPanel.tsx";
import { TopBar } from "./TopBar.tsx";
import { ToolDock } from "./ToolDock.tsx";
import { Toast } from "./Toast.tsx";
import "./app.css";

export function Workspace() {
  return (
    <div className="m-app">
      <TopBar />
      <div className="m-workspace">
        <LeftPanel />
        <main className="m-stage">
          <Canvas />
          <ToolDock />
          <Toast />
          <CodeDrawer />
          <ReviewCard />
          <AgentPrompt />
        </main>
        <RightPanel />
      </div>
      <SettingsDialog />
    </div>
  );
}
```

3. Create `tests/e2e/agent.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("an MCP agent's proposal is reviewed and accepted in Mason", async ({ page, request }) => {
  const original = css();
  await page.goto("/");
  await page.getByRole("button", { name: "MCP off" }).click();
  const dialog = page.getByTestId("settings-dialog");
  await dialog.getByLabel("Let MCP agents read pages and propose changes").check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "MCP on" })).toBeVisible();

  const reply = await request.post("/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "propose_style_changes", arguments: {
    page: "Home", summary: "Tighter tablet headline", agent_name: "Claude Code",
    changes: [
      { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" },
      { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all" },
    ] } } } });
  expect(reply.status()).toBe(200);
  expect(css()).toBe(original);

  const card = page.getByTestId("review-card");
  await expect(card).toContainText("Claude Code proposes 2 changes");
  await expect(card).toContainText("Blocked: No stock AI purple");
  await card.getByRole("button", { name: "Accept 1" }).click();
  await expect(page.getByTestId("toast")).toContainText("Applied 1 change from Claude Code");
  await expect(card).toHaveCount(0);
  expect(css()).toContain("font-size: 30px;");
  expect(css()).not.toContain("#7c3aed");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toBe(original);
});

test("MCP is refused while it is off", async ({ request }) => {
  const settings = JSON.parse(readFileSync("tests/.tmp/home/settings.json", "utf8"));
  settings.settings.mcpEnabled = false;
  const r0 = await request.post("/api/rpc/saveSettings", { data: { args: [settings.settings] } });
  expect(r0.status()).toBe(200);
  const r = await request.post("/mcp", { data: { jsonrpc: "2.0", id: 1, method: "ping" } });
  expect(r.status()).toBe(403);
});
```

4. Create `tests/ui/settings-dialog.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { SettingsDialog } from "../../src/ui/agent/SettingsDialog.tsx";
import { Workspace } from "../../src/ui/app/Workspace.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

describe("SettingsDialog", () => {
  it("edits agent, MCP and theme settings and saves them", async () => {
    const store = createFakeStore({ settingsOpen: true, settings: { ...DEFAULT_SETTINGS, hasApiKey: true } });
    render(<StudioContext.Provider value={store}><SettingsDialog /></StudioContext.Provider>);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toHaveAttribute("placeholder", "Saved. Type to replace it.");
    const model = screen.getByLabelText("Model");
    await userEvent.clear(model);
    await userEvent.type(model, "llama3.2");
    await userEvent.click(screen.getByLabelText("Let MCP agents read pages and propose changes"));
    await userEvent.click(screen.getByRole("tab", { name: "Light" }));
    expect(screen.getByTestId("settings-dialog")).toHaveTextContent("MCP endpoint: http://localhost:3000/mcp");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(store.calls).toEqual([{ name: "saveSettings", args: [{ ...DEFAULT_SETTINGS, hasApiKey: true, mcpEnabled: true, theme: "light", agent: { ...DEFAULT_SETTINGS.agent, model: "llama3.2" } }] }]);
  });
  it("cancels", async () => {
    const store = createFakeStore({ settingsOpen: true, settings: DEFAULT_SETTINGS });
    render(<StudioContext.Provider value={store}><SettingsDialog /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.calls).toEqual([{ name: "closeSettings", args: [] }]);
  });
  it("adds the review card, prompt and settings to the workspace", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", settingsOpen: true, agentPrompt: { open: true, busy: false } })}><Workspace /></StudioContext.Provider>);
    expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("agent-prompt")).toBeInTheDocument();
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- WHEN settings are edited and saved THE SYSTEM SHALL call saveSettings with the new model, MCP switch and theme. (test: "edits agent, MCP and theme settings and saves them")
- WHEN an MCP agent proposes two changes, one blocked, THE SYSTEM SHALL show the review card and Accept 1 SHALL write only the allowed change (verify: Playwright agent.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T080`.
The last line must be `GATE PASS T080`. On `GATE FAIL T080 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/app, components, canvas, panels, styles` and uses only the contracts (fakes only in tests).
- Do not change any class name, test id, aria-label, role or visible text from the code given.
- Do not use italics, inline color literals or new CSS variables.
- Do not import from `src/engine/` or `src/server/`; the UI talks to the studio only through the store.

## Done when

- `verify.ps1 -Card T080` prints `GATE PASS T080`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T080: Add settings and the agent UI to the workspace
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
