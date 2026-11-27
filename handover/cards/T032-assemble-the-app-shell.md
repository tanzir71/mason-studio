# T032: Assemble the app shell

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T032 (build), phase 3 |
| Depends on | T021, T030, T031 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15, R17 |

**Create:** `src/ui/app/Workspace.tsx`, `tests/ui/app.test.tsx`

**Modify:** `src/ui/app/App.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T032`):

1. `npx vitest run tests/ui/app.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`App` shows a start placeholder or the workspace (top bar, left panel, canvas with dock and toast, right panel area), applies the theme and runs shortcuts.

## Context

UI module, app area. Replaces the T002 stub `App.tsx`. The right panel area is an empty `right-panel` aside until phase 4; the start placeholder is replaced by the Start screen in phase 10. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export const StudioContext = createContext<StudioStore | null>(null);
/** Selector must return a primitive or a value stored in state (never a new object/array). */
export function useStudio<T>(select: (state: StudioState) => T): T {
  const store = useContext(StudioContext);
  if (!store) throw new Error("StudioContext is missing");
  return useSyncExternalStore(store.subscribe, () => select(store.getState()), () => select(store.getState()));
}
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

`src/ui/app/App.tsx` is the T002 stub. `TopBar.tsx`, `ToolDock.tsx`, `Toast.tsx`, `shortcuts.ts` (`useShortcuts`) exist in `src/ui/app/`; `Canvas.tsx` in `src/ui/canvas/`; `LeftPanel.tsx` in `src/ui/panels/`.

## Steps

1. Create `src/ui/app/Workspace.tsx` with exactly this content:

```tsx
import { TEST_IDS } from "../../contracts/ui.tsx";
import { Canvas } from "../canvas/Canvas.tsx";
import { LeftPanel } from "../panels/LeftPanel.tsx";
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
        </main>
        <aside className="m-right-placeholder" data-testid={TEST_IDS.rightPanel} />
      </div>
    </div>
  );
}
```

2. Replace the whole content of `src/ui/app/App.tsx` with exactly:

```tsx
import { useContext, useEffect } from "react";
import { StudioContext, TEST_IDS, useStudio } from "../../contracts/ui.tsx";
import { useShortcuts } from "./shortcuts.ts";
import { Workspace } from "./Workspace.tsx";
import "./app.css";

/** Placeholder start screen; the Start screen card replaces it. */
function StartPlaceholder() {
  return (
    <main className="m-start-placeholder" data-testid={TEST_IDS.startScreen}>
      <h1>Mason</h1>
      <p>Run mason with a folder to open it.</p>
    </main>
  );
}

export function App() {
  const store = useContext(StudioContext)!;
  const screen = useStudio((s) => s.screen);
  const theme = useStudio((s) => s.settings?.theme ?? "dark");
  useShortcuts(store);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return screen === "canvas" ? <Workspace /> : <StartPlaceholder />;
}
```

3. Create `tests/ui/app.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/ui/app/App.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };

describe("App", () => {
  it("shows the start screen before a project is open", () => {
    render(<StudioContext.Provider value={createFakeStore()}><App /></StudioContext.Provider>);
    expect(screen.getByTestId("start-screen")).toHaveTextContent("Mason");
  });
  it("shows the workspace for an open project", () => {
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home" })}><App /></StudioContext.Provider>);
    for (const id of ["top-bar", "left-panel", "canvas", "tool-dock", "right-panel"]) expect(screen.getByTestId(id)).toBeInTheDocument();
  });
  it("applies the theme from settings", () => {
    render(<StudioContext.Provider value={createFakeStore({ settings: { ...DEFAULT_SETTINGS, theme: "light" } })}><App /></StudioContext.Provider>);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("runs keyboard shortcuts on the canvas but not while typing", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><App /></StudioContext.Provider>);
    fireEvent.keyDown(window, { key: "h" });
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "r" });
    input.remove();
    expect(store.calls.filter((c) => c.name === "setTool")).toEqual([{ name: "setTool", args: ["hand"] }]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHILE no project is open THE SYSTEM SHALL show the start screen. (test: "shows the start screen before a project is open")
- WHILE a project is open THE SYSTEM SHALL show top bar, left panel, canvas, tool dock and right panel. (test: "shows the workspace for an open project")
- THE SYSTEM SHALL set `data-theme` on <html> from settings. (test: "applies the theme from settings")
- WHEN a key is pressed outside text inputs THE SYSTEM SHALL run the matching shortcut. (test: "runs keyboard shortcuts on the canvas but not while typing")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T032`.
The last line must be `GATE PASS T032`. On `GATE FAIL T032 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T032` prints `GATE PASS T032`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T032: Assemble the app shell
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
