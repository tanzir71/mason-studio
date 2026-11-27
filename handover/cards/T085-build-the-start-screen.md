# T085: Build the start screen

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T085 (build), phase 10 |
| Depends on | T084, T080 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R8, R35 |

**Create:** `src/ui/start/start.css`, `src/ui/start/StartScreen.tsx`, `tests/ui/start-screen.test.tsx`

**Modify:** `src/ui/app/App.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T085`):

1. `npx vitest run tests/ui/start-screen.test.tsx` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx vitest run tests/ui/app.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Without an open project Mason shows the start screen: open a folder (typed path, or the desktop folder picker), recent projects, and templates to create a new site.

## Context

UI module, start area. Follows Figma "Mason" → 02 App → Start. In the Electron app (phase 12) `window.masonDesktop.pickFolder()` replaces the typed path. The settings dialog is also available here. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface RecentProject { root: string; name: string; openedAt: number }
export interface TemplateInfo { id: TemplateId; name: string; meta: string }
export type TemplateId = "landing" | "portfolio" | "docs" | "blank";
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
/** Electron preload bridge (src/desktop/preload.ts). Absent in the browser. */
export interface MasonDesktopBridge { isDesktop: true; pickFolder(): Promise<string | null> }
```

## Current state

`src/ui/app/App.tsx` (T032) renders a `StartPlaceholder` when `screen` is "start". `src/ui/agent/agent.css` defines `.m-input`; `src/ui/agent/SettingsDialog.tsx` exports `SettingsDialog`.

## Steps

1. Create `src/ui/start/start.css` with exactly this content:

```css
.m-start { display: grid; grid-template-rows: 44px 1fr; min-height: 100vh; background: var(--bg-app); }
.m-start__bar { display: flex; align-items: center; justify-content: space-between; padding: 0 var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.m-start__brand { display: flex; align-items: center; gap: var(--space-2); font: var(--title-13); color: var(--text-strong); }
.m-start__main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; width: min(1040px, calc(100vw - 64px)); margin: 0 auto; padding: 88px 0 48px; align-content: start; }
.m-start__title { margin: 0; font: var(--heading-24); color: var(--text-strong); }
.m-start__lede { margin: 8px 0 24px; font: var(--text-13); color: var(--text-muted); }
.m-start__actions { display: grid; gap: var(--space-2); }
.m-action { display: grid; grid-template-columns: 32px 1fr; gap: 2px var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); border: 1px solid var(--border-default); border-radius: var(--radius-10); background: var(--bg-panel); color: var(--text-default); text-align: left; }
.m-action:hover { background: var(--bg-raised); }
.m-action__icon { grid-row: span 2; display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-8); background: var(--bg-raised); color: var(--accent-strong); }
.m-action__icon svg { width: 16px; height: 16px; }
.m-action__title { font: var(--title-13); color: var(--text-strong); }
.m-action__text { font: var(--text-12); color: var(--text-muted); }
.m-start__form { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
.m-start__form .m-input { flex: 1; min-width: 0; }
.m-start__section { margin: 28px 0 8px; font: var(--text-11); color: var(--text-faint); }
.m-recent { display: grid; margin: 0; padding: 0; list-style: none; }
.m-recent__item { display: grid; grid-template-columns: 16px auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-2); width: 100%; height: 32px; padding: 0 var(--space-2); border: 0; border-radius: var(--radius-6); background: transparent; color: var(--text-strong); font: var(--text-13); text-align: left; }
.m-recent__item:hover { background: var(--bg-hover); }
.m-recent__item svg { width: 14px; height: 14px; color: var(--text-faint); }
.m-recent__path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--code-11); color: var(--text-faint); }
.m-recent__when { font: var(--text-12); color: var(--text-faint); }
.m-templates__head { display: flex; justify-content: space-between; margin-bottom: var(--space-3); font: var(--title-13); color: var(--text-strong); }
.m-templates__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.m-template { display: grid; gap: 6px; padding: 0; border: 0; background: transparent; text-align: left; color: var(--text-strong); font: var(--label-12); }
.m-template__thumb { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: var(--radius-8); border: 1px solid var(--border-subtle); }
.m-template.is-chosen .m-template__thumb { box-shadow: 0 0 0 2px var(--accent); }
.m-template__meta { display: flex; justify-content: space-between; color: var(--text-faint); font: var(--text-11); }
.m-thumb--landing { background: #f3eee4; }
.m-thumb--portfolio { background: #151513; }
.m-thumb--docs { background: #ffffff; }
.m-thumb--blank { display: grid; place-items: center; border-style: dashed; border-color: var(--border-strong); color: var(--text-faint); font-size: 20px; }
.m-thumb__block { position: absolute; border-radius: 3px; }
```

2. Create `src/ui/start/StartScreen.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { Folder, FolderOpen, LayoutTemplate, Settings } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { TemplateId } from "../../contracts/model.ts";
import { Button, IconButton, cx } from "../components/Button.tsx";
import "../agent/agent.css";
import "./start.css";

/** "just now", "12 min ago", "3 h ago", "Yesterday", or "Nov 19". */
export function formatAgo(openedAt: number, now: number): string {
  const min = Math.floor((now - openedAt) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  if (h < 48) return "Yesterday";
  return new Date(openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Block = [number, number, number, number, string];
/** Abstract template previews: [left %, top %, width %, height %, color]. */
const THUMBS: Record<Exclude<TemplateId, "blank">, Block[]> = {
  landing: [[6, 8, 18, 5, "#1e2a22"], [74, 7, 20, 7, "#1e2a22"], [6, 26, 40, 7, "#1e2a22"], [6, 36, 30, 7, "#1e2a22"], [6, 52, 22, 7, "#b4532a"], [54, 24, 40, 40, "#c4956c"], [6, 74, 28, 14, "#fbf8f2"], [36, 74, 28, 14, "#fbf8f2"], [66, 74, 28, 14, "#fbf8f2"]],
  portfolio: [[6, 10, 26, 6, "#f4f3ef"], [6, 20, 50, 3, "#4a4944"], [6, 34, 28, 26, "#3a3936"], [36, 34, 28, 26, "#4a4944"], [66, 34, 28, 26, "#33322f"], [6, 64, 28, 26, "#4a4944"], [36, 64, 28, 26, "#5a5954"], [66, 64, 28, 26, "#3a3936"]],
  docs: [[0, 0, 26, 100, "#f0efea"], [6, 10, 14, 3, "#b9b5aa"], [6, 20, 12, 3, "#b9b5aa"], [6, 30, 14, 3, "#b9b5aa"], [32, 10, 40, 6, "#151513"], [32, 22, 60, 3, "#b9b5aa"], [32, 30, 56, 3, "#b9b5aa"], [32, 38, 60, 3, "#b9b5aa"], [32, 60, 60, 16, "#f0efea"]],
};

function Thumb({ id }: { id: TemplateId }) {
  if (id === "blank") return <div className="m-template__thumb m-thumb--blank" aria-hidden="true">+</div>;
  return (
    <div className={`m-template__thumb m-thumb--${id}`} aria-hidden="true">
      {THUMBS[id].map(([l, t, w, h, c], i) => <span key={i} className="m-thumb__block" style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, background: c }} />)}
    </div>
  );
}

export function StartScreen() {
  const actions = useActions();
  const recent = useStudio((s) => s.recent);
  const templates = useStudio((s) => s.templates);
  const [folder, setFolder] = useState("");
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [target, setTarget] = useState("");
  const desktop = typeof window !== "undefined" ? window.masonDesktop : undefined;
  const openFolder = async () => {
    if (desktop) { const picked = await desktop.pickFolder(); if (picked) void actions.openProject(picked); return; }
    if (folder.trim()) void actions.openProject(folder.trim());
  };
  const now = Date.now();
  return (
    <div className="m-start" data-testid={TEST_IDS.startScreen}>
      <header className="m-start__bar">
        <span className="m-start__brand"><span className="m-logo" aria-hidden="true">M</span>Mason</span>
        <IconButton label="Settings" onClick={() => actions.openSettings()}><Settings /></IconButton>
      </header>
      <main className="m-start__main">
        <section>
          <h1 className="m-start__title">Start designing</h1>
          <p className="m-start__lede">Your designs are plain HTML and CSS in a folder you choose. Nothing leaves this computer unless you connect an agent.</p>
          <div className="m-start__actions">
            <div className="m-action">
              <span className="m-action__icon"><FolderOpen /></span>
              <span className="m-action__title">Open a folder</span>
              <span className="m-action__text">Design on an existing site. Mason reads its HTML, CSS and tokens.</span>
              {desktop ? (
                <span />
              ) : (
                <form className="m-start__form" style={{ gridColumn: 2 }} onSubmit={(e) => { e.preventDefault(); void openFolder(); }}>
                  <input className="m-input" aria-label="Folder path" placeholder="/Users/you/Sites/my-site" value={folder} onChange={(e) => setFolder(e.target.value)} />
                  <Button type="submit" variant="primary" disabled={folder.trim() === ""}>Open</Button>
                </form>
              )}
              {desktop && <Button style={{ gridColumn: 2, justifySelf: "start" }} variant="primary" onClick={() => { void openFolder(); }}>Choose folder</Button>}
            </div>
            <div className="m-action">
              <span className="m-action__icon"><LayoutTemplate /></span>
              <span className="m-action__title">Start from a template</span>
              <span className="m-action__text">{template ? `New ${templates.find((t) => t.id === template)?.name ?? template} in an empty folder.` : "Pick a template on the right. Plain files you own."}</span>
              {template && (
                <form className="m-start__form" style={{ gridColumn: 2 }} onSubmit={(e) => { e.preventDefault(); if (target.trim()) void actions.createProject(target.trim(), template); }}>
                  <input className="m-input" aria-label="New folder path" placeholder="/Users/you/Sites/new-site" value={target} onChange={(e) => setTarget(e.target.value)} />
                  <Button type="submit" variant="primary" disabled={target.trim() === ""}>Create</Button>
                </form>
              )}
            </div>
          </div>
          {recent.length > 0 && (
            <>
              <h2 className="m-start__section">Recent</h2>
              <ul className="m-recent">
                {recent.map((r) => (
                  <li key={r.root}>
                    <button type="button" className="m-recent__item" onClick={() => { void actions.openProject(r.root); }}>
                      <Folder aria-hidden="true" />
                      <span>{r.name}</span>
                      <span className="m-recent__path">{r.root}</span>
                      <span className="m-recent__when">{formatAgo(r.openedAt, now)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section aria-label="Templates">
          <div className="m-templates__head"><span>Templates</span><span className="m-recent__when">Plain HTML and CSS</span></div>
          <div className="m-templates__grid">
            {templates.map((t) => (
              <button key={t.id} type="button" className={cx("m-template", template === t.id && "is-chosen")} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
                <Thumb id={t.id} />
                <span className="m-template__meta"><span style={{ color: "var(--text-strong)" }}>{t.name}</span><span>{t.meta}</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
```

3. Replace the whole content of `src/ui/app/App.tsx` with exactly:

```tsx
import { useContext, useEffect } from "react";
import { StudioContext, useStudio } from "../../contracts/ui.tsx";
import { SettingsDialog } from "../agent/SettingsDialog.tsx";
import { StartScreen } from "../start/StartScreen.tsx";
import { useShortcuts } from "./shortcuts.ts";
import { Workspace } from "./Workspace.tsx";
import "./app.css";

export function App() {
  const store = useContext(StudioContext)!;
  const screen = useStudio((s) => s.screen);
  const theme = useStudio((s) => s.settings?.theme ?? "dark");
  useShortcuts(store);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return screen === "canvas" ? <Workspace /> : <><StartScreen /><SettingsDialog /></>;
}
```

4. Create `tests/ui/start-screen.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StartScreen, formatAgo } from "../../src/ui/start/StartScreen.tsx";
import { App } from "../../src/ui/app/App.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { TemplateInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const templates: TemplateInfo[] = [{ id: "landing", name: "Landing page", meta: "1 page" }, { id: "blank", name: "Blank", meta: "Empty folder" }];
const now = Date.now();
afterEach(() => { delete window.masonDesktop; });

describe("StartScreen", () => {
  it("formats how long ago a project was opened", () => {
    const t = 1_700_000_000_000;
    expect([formatAgo(t, t + 30_000), formatAgo(t, t + 12 * 60_000), formatAgo(t, t + 3 * 3_600_000), formatAgo(t, t + 30 * 3_600_000)]).toEqual(["just now", "12 min ago", "3 h ago", "Yesterday"]);
    expect(formatAgo(Date.UTC(2026, 10, 19, 12), Date.UTC(2026, 10, 27, 12))).toBe("Nov 19");
  });
  it("opens recent projects and typed folders", async () => {
    const store = createFakeStore({ recent: [{ root: "/sites/north", name: "north", openedAt: now - 120_000 }], templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    expect(screen.getByRole("heading", { name: "Start designing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /north/ }));
    await userEvent.type(screen.getByLabelText("Folder path"), "/sites/other{Enter}");
    expect(store.calls).toEqual([{ name: "openProject", args: ["/sites/north"] }, { name: "openProject", args: ["/sites/other"] }]);
  });
  it("creates a project from a chosen template", async () => {
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: /Landing page/ }));
    expect(screen.getByRole("button", { name: /Landing page/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByLabelText("New folder path"), "/sites/new{Enter}");
    expect(store.calls).toEqual([{ name: "createProject", args: ["/sites/new", "landing"] }]);
  });
  it("uses the desktop folder picker when it exists", async () => {
    window.masonDesktop = { isDesktop: true, pickFolder: async () => "/picked" };
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    expect(screen.queryByLabelText("Folder path")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    expect(store.calls).toEqual([{ name: "openProject", args: ["/picked"] }]);
  });
  it("is the app's start screen with settings", async () => {
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><App /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(store.calls).toEqual([{ name: "openSettings", args: [] }]);
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show when a recent project was opened as just now, N min ago, N h ago, Yesterday or a date. (test: "formats how long ago a project was opened")
- WHEN a recent project or a typed folder is opened THE SYSTEM SHALL call openProject with its path. (test: "opens recent projects and typed folders")
- WHEN a template is chosen and a folder typed THE SYSTEM SHALL call createProject. (test: "creates a project from a chosen template")
- WHERE the desktop bridge exists THE SYSTEM SHALL use its folder picker. (test: "uses the desktop folder picker when it exists")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T085`.
The last line must be `GATE PASS T085`. On `GATE FAIL T085 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T085` prints `GATE PASS T085`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T085: Build the start screen
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
