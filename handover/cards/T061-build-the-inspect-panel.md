# T061: Build the Inspect panel

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T061 (build), phase 7 |
| Depends on | T044 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R22, R27 |

**Create:** `src/ui/panels/inspect.css`, `src/ui/panels/InspectPanel.tsx`, `tests/ui/inspect-panel.test.tsx`

**Modify:** `src/ui/panels/RightPanel.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T061`):

1. `npx vitest run tests/ui/inspect-panel.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/ui/right-panel.test.tsx` -> exit 0, output contains `Tests  1 passed (1)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The Inspect tab lists the selection's matching rules at the active board's breakpoint, marks overridden declarations, and opens a rule's `file:line` in the code drawer.

## Context

UI module, panels area. Data comes from `inspect.rules[activeBoard]` (T039). Overridden declarations are struck through, rules that do not apply at this width are dimmed. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface CascadeRow {
  rule: RuleRef; specificity: Specificity; applies: boolean;
  declarations: { prop: string; value: string; status: "winning" | "overridden" }[];
}
export interface InspectResult {
  page: string; path: ElementPath; name: string; tag: string; selector: string;
  props: Record<InspectProp, PropInfo>;
  rules: Record<BreakpointId, CascadeRow[]>;
}
/** Fixed breakpoint row shown for every page, in this order. */
export const BREAKPOINTS: readonly Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, maxWidth: null },
  { id: "tablet", label: "Tablet", width: 768, maxWidth: 768 },
  { id: "mobile", label: "Mobile", width: 375, maxWidth: 375 },
];
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

`src/ui/panels/RightPanel.tsx` (T044) shows this for the Inspect tab:

```tsx
      {tab === "inspect" && <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Select a layer to see its CSS.</div>}
```

## Steps

1. Create `src/ui/panels/inspect.css` with exactly this content:

```css
.m-inspect { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); padding: var(--space-3); }
.m-inspect__selector { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.m-inspect__selector code { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--code-12); color: var(--text-strong); }
.m-inspect__bp { font: var(--text-11); color: var(--text-muted); }
.m-rule { min-width: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-8); background: var(--bg-inset); }
.m-rule.is-inactive { opacity: 0.55; }
.m-rule__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: 6px var(--space-2); border-bottom: 1px solid var(--border-subtle); }
.m-rule__sel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--code-12); color: var(--text-strong); }
.m-rule__media { display: block; font: var(--code-11); color: var(--bp-tablet); }
.m-rule__link { flex: none; padding: 0; border: 0; background: transparent; color: var(--accent-strong); font: var(--code-11); }
.m-rule__link:hover { text-decoration: underline; }
.m-rule__decls { margin: 0; padding: 6px var(--space-2); list-style: none; font: var(--code-12); }
.m-rule__decl { color: var(--text-default); overflow-wrap: anywhere; }
.m-rule__decl.is-overridden { color: var(--text-faint); text-decoration: line-through; }
.m-rule__prop { color: var(--accent-strong); }
.m-rule__decl.is-overridden .m-rule__prop { color: inherit; }
```

2. Create `src/ui/panels/InspectPanel.tsx` with exactly this content:

```tsx
import { Copy } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import { IconButton, cx } from "../components/Button.tsx";
import "./inspect.css";

/** Cascade rules of the selection at the active board's breakpoint; file:line links open the code drawer. */
export function InspectPanel() {
  const actions = useActions();
  const selection = useStudio((s) => s.selection);
  const inspect = useStudio((s) => s.inspect);
  const activeBoard = useStudio((s) => s.activeBoard);
  if (selection === null) return <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Select a layer to see its CSS.</div>;
  if (!inspect || inspect.path !== selection) return <div className="m-empty" data-testid={TEST_IDS.inspectPanel}>Loading CSS…</div>;
  const bp = BREAKPOINTS.find((b) => b.id === activeBoard)!;
  const rows = inspect.rules[activeBoard];
  return (
    <div className="m-inspect" data-testid={TEST_IDS.inspectPanel}>
      <div className="m-inspect__selector">
        <code>{inspect.selector}</code>
        <IconButton label="Copy selector" onClick={() => { void navigator.clipboard?.writeText(inspect.selector); }}><Copy /></IconButton>
      </div>
      <span className="m-inspect__bp">{`Rules at ${bp.label} ${bp.width}px`}</span>
      {rows.length === 0 && <p className="m-empty">No rules match this element.</p>}
      {rows.map((row) => (
        <section key={`${row.rule.file}:${row.rule.line}`} className={cx("m-rule", !row.applies && "is-inactive")} data-rule={`${row.rule.file}:${row.rule.line}`}>
          <header className="m-rule__head">
            <span className="m-rule__sel">
              {row.rule.selector}
              {row.rule.media && <span className="m-rule__media">{`@media ${row.rule.media}`}</span>}
            </span>
            <button type="button" className="m-rule__link" onClick={() => { void actions.openCode(row.rule.file, row.rule.line); }}>
              {`${row.rule.file}:${row.rule.line}`}
            </button>
          </header>
          <ul className="m-rule__decls">
            {row.declarations.map((d, i) => (
              <li key={i} className={cx("m-rule__decl", d.status === "overridden" && "is-overridden")} data-status={d.status}>
                <span className="m-rule__prop">{d.prop}</span>{`: ${d.value};`}
              </li>
            ))}
          </ul>
        </section>
      ))}
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
      {tab === "checks" && <div className="m-empty" data-testid={TEST_IDS.checksPanel}>Checks run on the open page.</div>}
    </aside>
  );
}
```

4. Create `tests/ui/inspect-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { InspectPanel } from "../../src/ui/panels/InspectPanel.tsx";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function inspectHeadline() {
  const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await studio.openProject("/p");
  return studio.inspect("Home", "1.0.0.1");
}

describe("InspectPanel", () => {
  it("lists the rules at the active breakpoint with overridden declarations struck", async () => {
    const inspect = await inspectHeadline();
    const store = createFakeStore({ screen: "canvas", page: "Home", selection: "1.0.0.1", inspect, activeBoard: "tablet" });
    render(<StudioContext.Provider value={store}><InspectPanel /></StudioContext.Provider>);
    const panel = screen.getByTestId("inspect-panel");
    expect(panel).toHaveTextContent(".headline");
    expect(panel).toHaveTextContent("Rules at Tablet 768px");
    const media = panel.querySelector('[data-rule="styles.css:58"]')!;
    expect(media).toHaveTextContent("@media (max-width: 768px)");
    expect(within(media as HTMLElement).getByText("font-size").closest("li")).toHaveAttribute("data-status", "winning");
    const base = panel.querySelector('[data-rule="styles.css:22"]')!;
    const baseSize = within(base as HTMLElement).getByText("font-size").closest("li")!;
    expect(baseSize).toHaveClass("is-overridden");
    expect(panel.querySelector('[data-rule="styles.css:64"]')).toHaveClass("is-inactive");
  });
  it("opens the code drawer at a rule's line", async () => {
    const inspect = await inspectHeadline();
    const store = createFakeStore({ screen: "canvas", page: "Home", selection: "1.0.0.1", inspect });
    render(<StudioContext.Provider value={store}><InspectPanel /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "styles.css:22" }));
    expect(store.calls).toEqual([{ name: "openCode", args: ["styles.css", 22] }]);
  });
  it("asks for a selection", () => {
    render(<StudioContext.Provider value={createFakeStore({ selection: null })}><InspectPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("inspect-panel")).toHaveTextContent("Select a layer to see its CSS.");
  });
  it("is the Inspect tab of the right panel", () => {
    render(<StudioContext.Provider value={createFakeStore({ rightTab: "inspect", selection: null })}><RightPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("inspect-panel")).toBeInTheDocument();
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL list the rules at the active breakpoint, strike overridden declarations and dim rules that do not apply. (test: "lists the rules at the active breakpoint with overridden declarations struck")
- WHEN a rule's file:line is clicked THE SYSTEM SHALL call openCode with that file and line. (test: "opens the code drawer at a rule's line")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T061`.
The last line must be `GATE PASS T061`. On `GATE FAIL T061 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T061` prints `GATE PASS T061`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T061: Build the Inspect panel
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
