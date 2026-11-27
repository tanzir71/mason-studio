# T044: Add the right panel to the workspace

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T044 (build), phase 4 |
| Depends on | T043, T032, T040, S005 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19, R20, R23 |

**Create:** `src/ui/panels/RightPanel.tsx`, `tests/e2e/design.spec.ts`, `tests/ui/right-panel.test.tsx`

**Modify:** `src/ui/app/Workspace.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T044`):

1. `npx vitest run tests/ui/right-panel.test.tsx` -> exit 0, output contains `Tests  1 passed (1)`
2. `npx vitest run tests/ui/app.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test design.spec.ts --project=chromium` -> exit 0, output contains `2 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The workspace shows the right panel with Design, Inspect and Checks tabs, and the phase 4 smoke test edits real CSS through the browser.

## Context

UI module, app and panels areas. Inspect and Checks show placeholders until phases 7 and 8 replace them. This card also adds the phase 4 Playwright smoke spec, which runs the whole stack (engine, server, UI). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export type RightTab = "design" | "inspect" | "checks";
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

`src/ui/app/Workspace.tsx` (T032) imports `TEST_IDS` and renders this line where the right panel goes:

```tsx
        <aside className="m-right-placeholder" data-testid={TEST_IDS.rightPanel} />
```

## Steps

1. Create `src/ui/panels/RightPanel.tsx` with exactly this content:

```tsx
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { RightTab } from "../../contracts/ui.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { DesignPanel } from "./DesignPanel.tsx";
import "./panels.css";

const TABS: readonly { id: RightTab; label: string }[] = [
  { id: "design", label: "Design" }, { id: "inspect", label: "Inspect" }, { id: "checks", label: "Checks" },
];

export function RightPanel() {
  const actions = useActions();
  const tab = useStudio((s) => s.rightTab);
  return (
    <aside className="m-right" data-testid={TEST_IDS.rightPanel}>
      <div className="m-panel-head">
        <Tabs<RightTab> label="Right panel" value={tab} onChange={actions.setRightTab} items={TABS} />
      </div>
      {tab === "design" && <DesignPanel />}
      {tab === "inspect" && <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Select a layer to see its CSS.</div>}
      {tab === "checks" && <div className="m-empty" data-testid={TEST_IDS.checksPanel}>Checks run on the open page.</div>}
    </aside>
  );
}
```

2. In `src/ui/app/Workspace.tsx`: add `import { RightPanel } from "../panels/RightPanel.tsx";` below the `LeftPanel` import, replace the line shown under Current state with `        <RightPanel />`, and delete the now unused line `import { TEST_IDS } from "../../contracts/ui.tsx";`. The result must be exactly:

```tsx
import { Canvas } from "../canvas/Canvas.tsx";
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
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
```

3. Create `tests/e2e/design.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = () => readFileSync("tests/.tmp/northfield/styles.css", "utf8");

test("edits the tablet font size of the headline and undoes it", async ({ page }) => {
  const original = css();
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("scope-control").getByRole("tab", { name: "≤ 768" }).click();
  const size = page.getByLabel("Font size");
  await expect(size).toHaveValue("32px");
  await size.fill("30px");
  await size.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(css()).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
  const tabletH1 = page.getByTestId("board-Home-tablet").frameLocator("iframe").locator("h1");
  await expect(tabletH1).toHaveCSS("font-size", "30px");
  const desktopH1 = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(desktopH1).toHaveCSS("font-size", "40px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid: Saved to styles.css");
  expect(css()).toBe(original);
});

test("resets the mobile override", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await page.getByTestId("scope-control").getByRole("tab", { name: "≤ 375" }).click();
  await expect(page.getByLabel("Font size")).toHaveValue("28px");
  await page.getByTestId("design-text").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Font size")).toHaveValue("32px");
  expect(css()).not.toContain("28px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(css()).toContain("28px");
});
```

4. Create `tests/ui/right-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { INSPECT_PROPS } from "../../src/contracts/model.ts";
import type { ElementNode, InspectResult, PropInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const empty: PropInfo = { values: { desktop: null, tablet: null, mobile: null }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: [] };
const props = Object.fromEntries(INSPECT_PROPS.map((p) => [p, empty])) as InspectResult["props"];
props["font-size"] = { values: { desktop: "40px", tablet: "32px", mobile: "28px" }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: ["tablet", "mobile"] };
props.color = { values: { desktop: "#1e2a22", tablet: "#1e2a22", mobile: "#1e2a22" }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: [] };
const inspect: InspectResult = { page: "Home", path: "0.0", name: "Headline", tag: "h1", selector: ".headline", props, rules: { desktop: [], tablet: [], mobile: [] } };
const tree = { path: "", kind: "frame", children: [{ path: "0", kind: "stack", children: [{ path: "0.0", kind: "text", children: [] }] }] } as unknown as ElementNode;
const renderWith = (ui: React.ReactElement, state = {}) => {
  const store = createFakeStore({ screen: "canvas", page: "Home", selection: "0.0", inspect, tree, ...state });
  render(<StudioContext.Provider value={store}>{ui}</StudioContext.Provider>);
  return store;
};

describe("RightPanel", () => {
  it("switches between Design, Inspect and Checks", async () => {
    const store = renderWith(<RightPanel />);
    expect(screen.getByTestId("design-panel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(store.calls).toEqual([{ name: "setRightTab", args: ["checks"] }]);
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- WHEN a right panel tab is clicked THE SYSTEM SHALL call setRightTab. (test: "switches between Design, Inspect and Checks")
- WHEN the headline's tablet size is set to 30px in the browser THE SYSTEM SHALL write it into the 768 media rule, show it on the tablet board only, and Undo restores the file (verify: Playwright design.spec.ts).
- WHEN Reset is clicked for the mobile override THE SYSTEM SHALL remove it from styles.css (verify: Playwright design.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T044`.
The last line must be `GATE PASS T044`. On `GATE FAIL T044 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T044` prints `GATE PASS T044`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T044: Add the right panel to the workspace
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
