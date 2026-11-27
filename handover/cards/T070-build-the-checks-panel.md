# T070: Build the Checks panel

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T070 (build), phase 8 |
| Depends on | T067, T068, T069, T063 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R28, R29 |

**Create:** `src/ui/panels/checks.css`, `src/ui/panels/ChecksPanel.tsx`, `tests/e2e/checks.spec.ts`, `tests/ui/checks-panel.test.tsx`

**Modify:** `src/ui/panels/RightPanel.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T070`):

1. `npx vitest run tests/ui/checks-panel.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/ui/right-panel.test.tsx tests/ui/inspect-panel.test.tsx` -> exit 0, output contains `Tests  5 passed (5)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test checks.spec.ts --project=chromium` -> exit 0, output contains `2 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The Checks tab runs checks and contrast for the open page and lists findings by severity with code and layer links, plus what passed.

## Context

UI module, panels area. It finds the open page's desktop board iframe by its test id to measure contrast. This card also adds the phase 8 Playwright smoke spec. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface CheckFinding {
  id: string; kind: CheckKind; severity: Severity; title: string; detail: string;
  file: string | null; line: number | null; path: ElementPath | null;
}
export interface CheckReport { page: string; findings: CheckFinding[]; passed: string[] }
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

`src/ui/panels/RightPanel.tsx` (T061) shows this for the Checks tab:

```tsx
      {tab === "checks" && <div className="m-empty" data-testid={TEST_IDS.checksPanel}>Checks run on the open page.</div>}
```

## Steps

1. Create `src/ui/panels/checks.css` with exactly this content:

```css
.m-checks { display: grid; gap: var(--space-3); padding: var(--space-3); }
.m-checks__bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.m-checks__summary { font: var(--text-12); color: var(--text-muted); }
.m-checks__intro { margin: 0; font: var(--text-12); color: var(--text-muted); }
.m-findings { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.m-finding { display: grid; grid-template-columns: 8px 1fr; gap: 2px var(--space-2); padding: var(--space-2); border-radius: var(--radius-8); background: var(--bg-inset); }
.m-finding .m-dot { margin-top: 5px; }
.m-finding--blocked .m-dot { background: var(--danger); }
.m-finding--warning .m-dot { background: var(--warning); }
.m-finding--info .m-dot { background: var(--text-faint); }
.m-finding__title { font: var(--label-12); color: var(--text-strong); }
.m-finding__detail { grid-column: 2; font: var(--text-12); color: var(--text-muted); }
.m-finding__where { grid-column: 2; display: flex; gap: var(--space-2); }
.m-finding__link { padding: 0; border: 0; background: transparent; color: var(--accent-strong); font: var(--code-11); }
.m-finding__link:hover { text-decoration: underline; }
.m-passed { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; font: var(--text-12); color: var(--text-muted); }
.m-passed li { display: flex; align-items: center; gap: 6px; }
.m-passed svg { width: 14px; height: 14px; color: var(--success); }
```

2. Create `src/ui/panels/ChecksPanel.tsx` with exactly this content:

```tsx
import { useContext, useEffect } from "react";
import { Check } from "lucide-react";
import { StudioContext, TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { CheckFinding } from "../../contracts/model.ts";
import { Button } from "../components/Button.tsx";
import { collectContrast } from "../canvas/contrast.ts";
import "./checks.css";

const ORDER = { blocked: 0, warning: 1, info: 2 } as const;

/** The open page's desktop board document, found by its test id. */
export function desktopDocument(page: string): Document | null {
  const frame = document.querySelector(`[data-testid="${TEST_IDS.board}${page}-desktop"] iframe`) as HTMLIFrameElement | null;
  return frame?.contentDocument ?? null;
}

export function summaryText(findings: CheckFinding[]): string {
  const n = (s: CheckFinding["severity"]) => findings.filter((f) => f.severity === s).length;
  return `${n("blocked")} blocked · ${n("warning")} warnings · ${n("info")} notes`;
}

export function ChecksPanel() {
  const store = useContext(StudioContext)!;
  const actions = useActions();
  const page = useStudio((s) => s.page);
  const checks = useStudio((s) => s.checks);
  const contrast = useStudio((s) => s.contrast);
  const run = () => {
    const current = store.getState().page;
    if (current === null) return;
    void actions.runChecks();
    const doc = desktopDocument(current);
    actions.setContrast(doc ? collectContrast(doc) : []);
  };
  useEffect(() => { if (store.getState().checks === null) run(); }, [page]);
  const findings = [...(checks?.findings ?? []), ...contrast].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const passed = [...(checks?.passed ?? []), ...(checks && contrast.length === 0 ? ["Text contrast passes"] : [])];
  return (
    <div className="m-checks" data-testid={TEST_IDS.checksPanel}>
      <div className="m-checks__bar">
        <span className="m-checks__summary">{checks ? summaryText(findings) : "Not run yet"}</span>
        <Button size="sm" variant="secondary" onClick={run}>Run checks</Button>
      </div>
      {!checks && <p className="m-checks__intro">Checks look for taste bans, accessibility issues and raw colors on this page.</p>}
      {findings.length > 0 && (
        <ul className="m-findings">
          {findings.map((f) => (
            <li key={f.id} className={`m-finding m-finding--${f.severity}`} data-finding={f.id}>
              <span className="m-dot" />
              <span className="m-finding__title">{f.title}</span>
              {f.detail && <span className="m-finding__detail">{f.detail}</span>}
              {(f.file || f.path !== null) && (
                <span className="m-finding__where">
                  {f.file && (
                    <button type="button" className="m-finding__link" onClick={() => { void actions.openCode(f.file!, f.line); }}>
                      {f.line ? `${f.file}:${f.line}` : f.file}
                    </button>
                  )}
                  {f.path !== null && <button type="button" className="m-finding__link" onClick={() => actions.select(f.path)}>Select layer</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <ul className="m-passed" aria-label="Passed">
          {passed.map((p) => <li key={p}><Check aria-hidden="true" />{p}</li>)}
        </ul>
      )}
    </div>
  );
}
```

3. Replace the whole content of `src/ui/panels/RightPanel.tsx` with exactly:

```tsx
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { RightTab } from "../../contracts/ui.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { DesignPanel } from "./DesignPanel.tsx";
import { InspectPanel } from "./InspectPanel.tsx";
import { ChecksPanel } from "./ChecksPanel.tsx";
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
      {tab === "inspect" && <InspectPanel />}
      {tab === "checks" && <ChecksPanel />}
    </aside>
  );
}
```

4. Create `tests/e2e/checks.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";

test("runs checks for the home page and opens a finding in code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1")).toBeVisible();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Checks" }).click();
  const panel = page.getByTestId("checks-panel");
  await expect(panel.locator('[data-finding="tokens:styles.css:22:color"]')).toContainText("Use color.ink instead.");
  await expect(panel.locator('[data-finding="taste:invalid:0"]')).toContainText("Invalid regex: ([");
  await expect(panel.getByRole("list", { name: "Passed" })).toContainText("No hard bans matched");
  await panel.locator('[data-finding="tokens:styles.css:22:color"]').getByRole("button", { name: "styles.css:22" }).click();
  await expect(page.getByTestId("code-drawer")).toContainText("styles.css");
});

test("flags the image without alt text on the menu page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pages-list").getByRole("button", { name: /^Menu/ }).click();
  await page.getByTestId("right-panel").getByRole("tab", { name: "Checks" }).click();
  const finding = page.getByTestId("checks-panel").locator('[data-finding^="a11y:alt:"]');
  await expect(finding).toContainText("Image has no alt text");
  await finding.getByRole("button", { name: "Select layer" }).click();
  await expect(page.getByTestId("layers-tree").getByRole("treeitem", { selected: true })).toHaveCount(1);
});
```

5. Create `tests/ui/checks-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChecksPanel, summaryText } from "../../src/ui/panels/ChecksPanel.tsx";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { CheckFinding, CheckReport } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const ban: CheckFinding = { id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "styles.css", line: 67, path: null };
const alt: CheckFinding = { id: "a11y:alt:0.1", kind: "a11y", severity: "warning", title: "Image has no alt text", detail: "", file: null, line: null, path: "0.1" };
const report: CheckReport = { page: "Home", findings: [ban], passed: ["Headings in order"] };

describe("ChecksPanel", () => {
  it("summarizes findings by severity", () => {
    expect(summaryText([ban, alt, alt])).toBe("1 blocked · 2 warnings · 0 notes");
  });
  it("runs checks and contrast when it opens without a report", () => {
    const store = createFakeStore({ screen: "canvas", page: "Home" });
    render(<StudioContext.Provider value={store}><ChecksPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("checks-panel")).toHaveTextContent("Not run yet");
    expect(store.calls).toEqual([{ name: "runChecks", args: [] }, { name: "setContrast", args: [[]] }]);
  });
  it("lists findings with links and the passed checks", async () => {
    const store = createFakeStore({ screen: "canvas", page: "Home", checks: report, contrast: [alt] });
    render(<StudioContext.Provider value={store}><ChecksPanel /></StudioContext.Provider>);
    const panel = screen.getByTestId("checks-panel");
    expect(panel).toHaveTextContent("1 blocked · 1 warnings · 0 notes");
    const items = within(panel).getAllByRole("listitem").map((li) => li.getAttribute("data-finding"));
    expect(items.slice(0, 2)).toEqual(["taste:11", "a11y:alt:0.1"]);
    await userEvent.click(screen.getByRole("button", { name: "styles.css:67" }));
    await userEvent.click(screen.getByRole("button", { name: "Select layer" }));
    expect(store.calls).toEqual([{ name: "openCode", args: ["styles.css", 67] }, { name: "select", args: ["0.1"] }]);
    expect(within(screen.getByRole("list", { name: "Passed" })).getByText("Headings in order")).toBeInTheDocument();
  });
  it("is the Checks tab of the right panel", () => {
    render(<StudioContext.Provider value={createFakeStore({ rightTab: "checks", page: "Home", checks: report })}><RightPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- WHEN the panel opens without a report THE SYSTEM SHALL run checks and contrast. (test: "runs checks and contrast when it opens without a report")
- THE SYSTEM SHALL list findings with file:line and Select layer links and the passed checks. (test: "lists findings with links and the passed checks")
- WHEN checks run on the fixture THE SYSTEM SHALL show token suggestions, the invalid regex and the menu page's missing alt (verify: Playwright checks.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T070`.
The last line must be `GATE PASS T070`. On `GATE FAIL T070 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T070` prints `GATE PASS T070`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T070: Build the Checks panel
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
