# T028: Build the top bar

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T028 (build), phase 3 |
| Depends on | T022 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/app/app.css`, `src/ui/app/TopBar.tsx`, `tests/ui/top-bar.test.tsx`

**Modify:** none

**Read only:** `src/ui/components/Button.tsx`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T028`):

1. `npx vitest run tests/ui/top-bar.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`TopBar` shows the project and page menus, the breakpoint strip, the MCP status and the preview button.

## Context

UI module, app area. `app.css` holds the layout, top bar, menus, tool dock and toast styles for the whole app shell. The comment `{/* git chip: added by the Git card */}` marks where phase 10 puts the Git chip; keep it. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

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

```ts
// src/contracts/model.ts
/** Fixed breakpoint row shown for every page, in this order. */
export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 768, maxWidth: 768 },
  { id: "mobile", label: "Mobile", width: 375, maxWidth: 375 },
];
```

## Current state

`src/ui/app/` has `App.tsx` (stub). `src/ui/components/Button.tsx` exports `Chip` and `IconButton`.

## Steps

1. Create `src/ui/app/app.css` with exactly this content:

```css
.m-app { display: grid; grid-template-rows: var(--top-bar) 1fr; height: 100vh; overflow: hidden; background: var(--bg-app); }
.m-workspace { display: grid; grid-template-columns: var(--panel-left) 1fr var(--panel-right); min-height: 0; }
.m-stage { position: relative; min-width: 0; min-height: 0; }

.m-topbar {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--space-3);
  padding: 0 var(--space-2) 0 var(--space-3); border-bottom: 1px solid var(--border-subtle); background: var(--bg-panel);
}
.m-topbar__left, .m-topbar__right { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.m-topbar__right { justify-content: flex-end; }
.m-logo {
  display: grid; place-items: center; width: 22px; height: 22px; border-radius: var(--radius-6);
  background: var(--surface-inverse); color: var(--ink-inverse); font: 700 12px/1 var(--font-sans);
}
.m-crumb { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 6px; border: 0; border-radius: var(--radius-6); background: transparent; color: var(--text-strong); font: var(--title-13); }
.m-crumb:hover { background: var(--bg-hover); }
.m-crumb--page { color: var(--text-default); font: var(--text-13); }
.m-crumb svg { width: 14px; height: 14px; color: var(--text-faint); }
.m-sep { color: var(--text-faint); }
.m-strip { display: flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--border-subtle); border-radius: var(--radius-8); background: var(--bg-inset); }
.m-status { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--space-2); border: 0; border-radius: var(--radius-6); background: transparent; color: var(--text-default); font: var(--label-12); }
.m-status:hover { background: var(--bg-hover); }

.m-menu {
  position: absolute; z-index: 30; min-width: 180px; padding: 4px; border: 1px solid var(--border-default);
  border-radius: var(--radius-8); background: var(--bg-raised); box-shadow: var(--shadow-float);
}
.m-menu__item { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; height: 28px; padding: 0 8px; border: 0; border-radius: var(--radius-4); background: transparent; color: var(--text-default); text-align: left; font: var(--text-12); }
.m-menu__item:hover { background: var(--bg-hover); color: var(--text-strong); }
.m-menu__meta { font: var(--code-11); color: var(--text-faint); }
.m-anchor { position: relative; }

.m-dock {
  position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 10; display: flex; align-items: center; gap: 2px;
  padding: 4px; border: 1px solid var(--border-default); border-radius: var(--radius-10); background: var(--bg-panel); box-shadow: var(--shadow-float);
}
.m-dock__sep { width: 1px; height: 20px; margin: 0 4px; background: var(--border-default); }

.m-toast {
  position: absolute; left: 12px; bottom: 12px; z-index: 20; display: flex; align-items: center; gap: var(--space-2);
  height: 36px; padding: 0 6px 0 12px; border: 1px solid var(--border-default); border-radius: var(--radius-8);
  background: var(--bg-panel); box-shadow: var(--shadow-float); color: var(--text-strong); font: var(--text-12);
}
.m-toast--success .m-dot { background: var(--success); }
.m-toast--error { border-color: var(--danger); }
.m-toast--error .m-dot { background: var(--danger); }
.m-toast--info .m-dot { background: var(--accent); }

.m-start-placeholder { display: grid; place-content: center; gap: var(--space-2); height: 100vh; text-align: center; }
.m-start-placeholder h1 { margin: 0; font: var(--heading-24); color: var(--text-strong); }
.m-start-placeholder p { margin: 0; color: var(--text-muted); }
.m-right-placeholder { border-left: 1px solid var(--border-subtle); background: var(--bg-panel); }
```

2. Create `src/ui/app/TopBar.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import { Chip, IconButton } from "../components/Button.tsx";
import "./app.css";

export function TopBar() {
  const actions = useActions();
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const activeBoard = useStudio((s) => s.activeBoard);
  const mcpEnabled = useStudio((s) => s.settings?.mcpEnabled ?? false);
  const [menu, setMenu] = useState<"project" | "page" | null>(null);
  if (!project) return null;
  const info = project.pages.find((p) => p.name === page) ?? null;
  const toggle = (m: "project" | "page") => setMenu(menu === m ? null : m);
  return (
    <header className="m-topbar" data-testid={TEST_IDS.topBar}>
      <div className="m-topbar__left">
        <span className="m-logo" aria-hidden="true">M</span>
        <div className="m-anchor">
          <button type="button" className="m-crumb" aria-haspopup="menu" aria-expanded={menu === "project"} onClick={() => toggle("project")}>
            {project.name}<ChevronDown />
          </button>
          {menu === "project" && (
            <div className="m-menu" role="menu">
              <button type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); actions.openSettings(); }}>Settings</button>
              <button type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); actions.closeProject(); }}>Close project</button>
            </div>
          )}
        </div>
        <span className="m-sep">/</span>
        <div className="m-anchor">
          <button type="button" className="m-crumb m-crumb--page" aria-haspopup="menu" aria-expanded={menu === "page"} onClick={() => toggle("page")}>
            {page ?? "No page"}<ChevronDown />
          </button>
          {menu === "page" && (
            <div className="m-menu" role="menu">
              {project.pages.map((p) => (
                <button key={p.name} type="button" role="menuitem" className="m-menu__item" onClick={() => { setMenu(null); void actions.selectPage(p.name); }}>
                  {p.name}<span className="m-menu__meta">{p.file}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="m-strip" data-testid={TEST_IDS.breakpointStrip}>
        {BREAKPOINTS.map((bp) => (
          <Chip key={bp.id} active={activeBoard === bp.id} dot={`var(--bp-${bp.id})`} meta={bp.maxWidth === null ? String(bp.width) : `≤ ${bp.maxWidth}`}
            onClick={() => actions.setActiveBoard(bp.id)}>
            {bp.label}
          </Chip>
        ))}
      </div>
      <div className="m-topbar__right">
        <button type="button" className="m-status" onClick={() => actions.openSettings()}>
          <span className="m-dot" style={{ background: mcpEnabled ? "var(--success)" : "var(--text-faint)" }} />
          {mcpEnabled ? "MCP on" : "MCP off"}
        </button>
        {/* git chip: added by the Git card */}
        <IconButton label="Preview page" disabled={!info} onClick={() => { if (info) window.open(`/p/${info.file}`, "_blank", "noopener"); }}>
          <Play />
        </IconButton>
      </div>
    </header>
  );
}
```

3. Create `tests/ui/top-bar.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TopBar } from "../../src/ui/app/TopBar.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "northfield-site", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};
const renderBar = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", project, page: "Home", ...state });
  render(<StudioContext.Provider value={store}><TopBar /></StudioContext.Provider>);
  return store;
};

describe("TopBar", () => {
  it("shows project, page and the breakpoint strip", () => {
    renderBar({ activeBoard: "tablet" });
    expect(screen.getByTestId("top-bar")).toHaveTextContent("northfield-site");
    const strip = screen.getByTestId("breakpoint-strip");
    expect(strip).toHaveTextContent("Desktop1280Tablet≤ 768Mobile≤ 375");
    expect(screen.getByRole("button", { name: /Tablet/ })).toHaveAttribute("aria-pressed", "true");
  });
  it("switches boards from the strip", async () => {
    const store = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Mobile/ }));
    expect(store.calls).toEqual([{ name: "setActiveBoard", args: ["mobile"] }]);
  });
  it("opens pages and project actions from the menus", async () => {
    const store = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Menu/ }));
    await userEvent.click(screen.getByRole("button", { name: "northfield-site" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Close project" }));
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }, { name: "closeProject", args: [] }]);
  });
  it("shows the MCP state and previews the page", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderBar({ settings: { ...DEFAULT_SETTINGS, mcpEnabled: true } });
    expect(screen.getByRole("button", { name: "MCP on" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview page" }));
    expect(open).toHaveBeenCalledWith("/p/index.html", "_blank", "noopener");
    open.mockRestore();
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show the project name and a breakpoint strip with Desktop 1280, Tablet ≤ 768, Mobile ≤ 375. (test: "shows project, page and the breakpoint strip")
- WHEN a page or Close project is chosen from the menus THE SYSTEM SHALL call selectPage or closeProject. (test: "opens pages and project actions from the menus")
- WHEN Preview page is clicked THE SYSTEM SHALL open `/p/<file>` in a new tab. (test: "shows the MCP state and previews the page")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T028`.
The last line must be `GATE PASS T028`. On `GATE FAIL T028 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T028` prints `GATE PASS T028`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T028: Build the top bar
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
