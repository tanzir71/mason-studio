# T063: Add the code drawer to the workspace

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T063 (build), phase 7 |
| Depends on | T062, T060, T061, T059, T058 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R27 |

**Create:** `src/ui/code/code.css`, `src/ui/code/CodeDrawer.tsx`, `tests/e2e/code.spec.ts`, `tests/ui/code-drawer.test.tsx`

**Modify:** `src/ui/app/Workspace.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T063`):

1. `npx vitest run tests/ui/code-drawer.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/ui/app.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test code.spec.ts --project=chromium` -> exit 0, output contains `1 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The code drawer opens over the bottom of the canvas with the file name, unsaved dot, Save and Close; the phase 7 smoke test edits styles.css from Inspect.

## Context

UI module, code and app areas. This card also adds the phase 7 Playwright smoke spec; it undoes its edit. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export interface CodeState { open: boolean; file: string | null; line: number | null; text: string | null; dirty: boolean }
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

`src/ui/app/Workspace.tsx` (T044) renders `<Canvas />`, `<ToolDock />` and `<Toast />` inside `<main className="m-stage">`. `src/ui/code/CodeEditor.tsx` exports `CodeEditor`.

## Steps

1. Create `src/ui/code/code.css` with exactly this content:

```css
.m-code { position: absolute; left: 0; right: 0; bottom: 0; z-index: 15; display: grid; grid-template-rows: 36px 1fr; height: 42%; min-height: 200px;
  border-top: 1px solid var(--border-default); background: var(--bg-inset); box-shadow: var(--shadow-float); }
.m-code__head { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-2) 0 var(--space-3); border-bottom: 1px solid var(--border-subtle); background: var(--bg-panel); }
.m-code__file { font: var(--code-12); color: var(--text-strong); }
.m-code__dirty { width: 6px; height: 6px; border-radius: 50%; background: var(--warning); }
.m-code__spacer { flex: 1; }
.m-code-editor { min-height: 0; overflow: hidden; }
.m-code-editor .cm-editor { height: 100%; }
```

2. Create `src/ui/code/CodeDrawer.tsx` with exactly this content:

```tsx
import { X } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button, IconButton } from "../components/Button.tsx";
import { CodeEditor } from "./CodeEditor.tsx";
import "./code.css";

/** Bottom drawer with the open file. Save writes it through the studio (one undo step). */
export function CodeDrawer() {
  const actions = useActions();
  const code = useStudio((s) => s.code);
  const busy = useStudio((s) => s.busy);
  if (!code.open || code.file === null || code.text === null) return null;
  return (
    <section className="m-code" data-testid={TEST_IDS.codeDrawer} aria-label="Code">
      <header className="m-code__head">
        <span className="m-code__file">{code.file}</span>
        {code.dirty && <span className="m-code__dirty" aria-label="Unsaved changes" role="img" />}
        <span className="m-code__spacer" />
        <Button size="sm" variant="primary" disabled={!code.dirty || busy} onClick={() => { void actions.saveCode(); }}>Save</Button>
        <IconButton label="Close code" onClick={() => actions.closeCode()}><X /></IconButton>
      </header>
      <CodeEditor file={code.file} value={code.text} line={code.line}
        onChange={(text) => actions.editCode(text)} onSave={() => { void actions.saveCode(); }} />
    </section>
  );
}
```

3. Replace the whole content of `src/ui/app/Workspace.tsx` with exactly:

```tsx
import { Canvas } from "../canvas/Canvas.tsx";
import { CodeDrawer } from "../code/CodeDrawer.tsx";
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
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
```

4. Create `tests/e2e/code.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("opens a rule from Inspect in the code drawer, edits and saves it", async ({ page }) => {
  const original = css();
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Inspect" }).click();
  const inspect = page.getByTestId("inspect-panel");
  await expect(inspect.locator('[data-rule="styles.css:22"] [data-status="winning"]').first()).toBeVisible();
  await inspect.getByRole("button", { name: "styles.css:22" }).click();
  const drawer = page.getByTestId("code-drawer");
  await expect(drawer).toContainText("styles.css");
  await drawer.locator(".cm-content").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("/* edited in Mason */\n");
  await expect(drawer.getByRole("img", { name: "Unsaved changes" })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(css().startsWith("/* edited in Mason */\n")).toBe(true);
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toBe(original);
  await drawer.getByRole("button", { name: "Close code" }).click();
  await expect(drawer).toHaveCount(0);
});
```

5. Create `tests/ui/code-drawer.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CodeDrawer } from "../../src/ui/code/CodeDrawer.tsx";
import { Workspace } from "../../src/ui/app/Workspace.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

// jsdom has no layout: CodeMirror measures text ranges, so give Range empty rects.
Range.prototype.getClientRects = function () { return [] as unknown as DOMRectList; };
Range.prototype.getBoundingClientRect = function () { return new DOMRect(); };

const open = { open: true, file: "styles.css", line: 1, text: "a {}\n", dirty: true };

describe("CodeDrawer", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><CodeDrawer /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
  it("shows the file with its unsaved state and saves or closes", async () => {
    const store = createFakeStore({ code: open });
    render(<StudioContext.Provider value={store}><CodeDrawer /></StudioContext.Provider>);
    const drawer = screen.getByTestId("code-drawer");
    expect(drawer).toHaveTextContent("styles.css");
    expect(screen.getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Close code" }));
    expect(store.calls.map((c) => c.name)).toEqual(["saveCode", "closeCode"]);
  });
  it("disables Save for a clean file", () => {
    render(<StudioContext.Provider value={createFakeStore({ code: { ...open, dirty: false } })}><CodeDrawer /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
  it("is part of the workspace", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", code: open })}><Workspace /></StudioContext.Provider>);
    expect(screen.getByTestId("code-drawer")).toBeInTheDocument();
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- WHILE the drawer is closed THE SYSTEM SHALL render nothing. (test: "renders nothing while closed")
- THE SYSTEM SHALL show the file, an unsaved marker, Save and Close. (test: "shows the file with its unsaved state and saves or closes")
- WHEN a rule link in Inspect is clicked, the file edited and Ctrl+S pressed THE SYSTEM SHALL save styles.css; Undo restores it (verify: Playwright code.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T063`.
The last line must be `GATE PASS T063`. On `GATE FAIL T063 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T063` prints `GATE PASS T063`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T063: Add the code drawer to the workspace
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
