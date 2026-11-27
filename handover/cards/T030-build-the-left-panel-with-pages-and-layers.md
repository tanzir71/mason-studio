# T030: Build the left panel with pages and layers

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T030 (build), phase 3 |
| Depends on | T023, T029 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R7, R15 |

**Create:** `src/ui/panels/LeftPanel.tsx`, `tests/ui/left-panel.test.tsx`

**Modify:** none

**Read only:** `src/ui/panels/LayersTree.tsx`, `src/ui/components/Tabs.tsx`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T030`):

1. `npx vitest run tests/ui/left-panel.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`LeftPanel` has the Layers/Assets tabs, the Pages list with an inline "New page" field, and the layers tree.

## Context

UI module, panels area. The Assets tab shows an empty `assets-panel` area until phase 6 fills it. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
/** Selector must return a primitive or a value stored in state (never a new object/array). */
export function useStudio<T>(select: (state: StudioState) => T): T {
  const store = useContext(StudioContext);
  if (!store) throw new Error("StudioContext is missing");
  return useSyncExternalStore(store.subscribe, () => select(store.getState()), () => select(store.getState()));
}
export function useActions(): StudioActions {
  const store = useContext(StudioContext);
  if (!store) throw new Error("StudioContext is missing");
  return store.actions;
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

`src/ui/panels/LayersTree.tsx` exports `LayersTree`; `src/ui/panels/panels.css` has the `.m-left`, `.m-group*`, `.m-row*` and `.m-new-page` rules. `src/ui/components/Tabs.tsx` exports `Tabs`.

## Steps

1. Create `src/ui/panels/LeftPanel.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { IconButton, cx } from "../components/Button.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { LayersTree } from "./LayersTree.tsx";
import "./panels.css";

export function LeftPanel() {
  const actions = useActions();
  const leftTab = useStudio((s) => s.leftTab);
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <aside className="m-left" data-testid={TEST_IDS.leftPanel}>
      <div className="m-panel-head">
        <Tabs label="Left panel" value={leftTab} onChange={actions.setLeftTab}
          items={[{ id: "layers", label: "Layers" }, { id: "assets", label: "Assets" }]} />
      </div>
      {leftTab === "layers" ? (
        <div className="m-panel-scroll">
          <div className="m-group" data-testid={TEST_IDS.pagesList}>
            <div className="m-group__head">
              <h2 className="m-group__title">Pages</h2>
              <IconButton label="New page" onClick={() => { setAdding(true); setName(""); }}><Plus /></IconButton>
            </div>
            {project?.pages.map((p) => (
              <button key={p.name} type="button" className={cx("m-row", p.name === page && "is-selected")} onClick={() => { void actions.selectPage(p.name); }}>
                <span className="m-row__name">{p.name}</span>
                <span className="m-row__meta">{p.file}</span>
              </button>
            ))}
            {adding && (
              <div className="m-new-page">
                <input
                  className="m-field__input m-field" aria-label="New page name" placeholder="Page name" autoFocus value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setAdding(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) { setAdding(false); void actions.createPage(name.trim()); }
                    if (e.key === "Escape") setAdding(false);
                  }}
                />
              </div>
            )}
          </div>
          <div className="m-group">
            <div className="m-group__head"><h2 className="m-group__title">Layers</h2></div>
            <LayersTree />
          </div>
        </div>
      ) : (
        <div className="m-panel-scroll" data-testid={TEST_IDS.assetsPanel} />
      )}
    </aside>
  );
}
```

2. Create `tests/ui/left-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { LeftPanel } from "../../src/ui/panels/LeftPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};
const renderPanel = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", project, page: "Home", ...state });
  render(<StudioContext.Provider value={store}><LeftPanel /></StudioContext.Provider>);
  return store;
};

describe("LeftPanel", () => {
  it("lists pages with their files and marks the open page", () => {
    renderPanel();
    const pages = screen.getByTestId("pages-list");
    expect(within(pages).getByRole("button", { name: "Homeindex.html" })).toHaveClass("is-selected");
    expect(within(pages).getByRole("button", { name: "Menumenu.html" })).not.toHaveClass("is-selected");
    expect(screen.getByTestId("layers-tree")).toBeInTheDocument();
  });
  it("opens a page and creates a new one", async () => {
    const store = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Menumenu.html" }));
    await userEvent.click(screen.getByRole("button", { name: "New page" }));
    await userEvent.type(screen.getByLabelText("New page name"), "Wholesale{Enter}");
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }, { name: "createPage", args: ["Wholesale"] }]);
    expect(screen.queryByLabelText("New page name")).toBeNull();
  });
  it("switches to the assets tab", async () => {
    const store = renderPanel();
    await userEvent.click(screen.getByRole("tab", { name: "Assets" }));
    expect(store.calls).toEqual([{ name: "setLeftTab", args: ["assets"] }]);
  });
  it("shows the assets area when the assets tab is open", () => {
    renderPanel({ leftTab: "assets" });
    expect(screen.getByTestId("assets-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("pages-list")).toBeNull();
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL list pages with their files and mark the open page. (test: "lists pages with their files and marks the open page")
- WHEN a name is typed into New page and Enter is pressed THE SYSTEM SHALL call createPage with it. (test: "opens a page and creates a new one")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T030`.
The last line must be `GATE PASS T030`. On `GATE FAIL T030 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T030` prints `GATE PASS T030`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T030: Build the left panel with pages and layers
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
