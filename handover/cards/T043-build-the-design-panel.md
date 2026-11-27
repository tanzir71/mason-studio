# T043: Build the Design panel

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T043 (build), phase 4 |
| Depends on | T041, T042 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19, R20, R23 |

**Create:** `src/ui/panels/DesignPanel.tsx`, `tests/ui/design-panel.test.tsx`

**Modify:** none

**Read only:** `src/ui/panels/design-fields.ts`, `src/ui/panels/ScopeControl.tsx`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T043`):

1. `npx vitest run tests/ui/design-panel.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`DesignPanel` shows the selected layer, the scope switch and Layout/Text/Fill/Stroke/Effects fields that write through `applyStyle`, with override notes and Reset.

## Context

UI module, panels area. Text fields appear only for text and link layers. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
/** Human labels used in proposals and the Design panel ("Headline size"). */
export const PROP_LABELS: Record<InspectProp, string> = {
  "display": "display", "flex-direction": "direction", "gap": "gap", "justify-content": "justify", "align-items": "align",
  "grid-template-columns": "columns", "width": "width", "height": "height", "max-width": "max width", "padding": "padding",
  "margin": "margin", "font-family": "font", "font-weight": "weight", "font-size": "size", "line-height": "line height",
  "letter-spacing": "letter spacing", "text-align": "alignment", "color": "color", "background-color": "fill",
  "border": "stroke", "border-radius": "radius", "opacity": "opacity", "box-shadow": "shadow",
};
export interface InspectResult {
  page: string; path: ElementPath; name: string; tag: string; selector: string;
  props: Record<InspectProp, PropInfo>;
  rules: Record<BreakpointId, CascadeRow[]>;
}
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

`src/ui/panels/design-fields.ts` exports `DESIGN_FIELDS`, `SECTION_TITLES`, `SCOPE_LABELS`, `sectionsFor`, `fieldView`, `nodeAt`; `ScopeControl.tsx` exports `ScopeControl`. `src/ui/components/Field.tsx` exports `Field` and `Section`.

## Steps

1. Create `src/ui/panels/DesignPanel.tsx` with exactly this content:

```tsx
import { Hash, Image, Link, RotateCcw, Rows3, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { PROP_LABELS } from "../../contracts/model.ts";
import type { LayerKind } from "../../contracts/model.ts";
import { Button, cx } from "../components/Button.tsx";
import { Field, Section } from "../components/Field.tsx";
import { DESIGN_FIELDS, SCOPE_LABELS, SECTION_TITLES, fieldView, nodeAt, sectionsFor } from "./design-fields.ts";
import { ScopeControl } from "./ScopeControl.tsx";
import "./design.css";

const KIND_ICONS: Record<LayerKind, LucideIcon> = { frame: Hash, stack: Rows3, text: Type, image: Image, link: Link };
const MONO = new Set(["grid-template-columns", "box-shadow", "font-family"]);

export function DesignPanel() {
  const actions = useActions();
  const selection = useStudio((s) => s.selection);
  const inspect = useStudio((s) => s.inspect);
  const tree = useStudio((s) => s.tree);
  const scope = useStudio((s) => s.scope);
  if (selection === null) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Select a layer to edit its style.</div>;
  if (!inspect || inspect.path !== selection) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Loading styles…</div>;
  const kind = (tree && nodeAt(tree, selection)?.kind) || "frame";
  const Icon = KIND_ICONS[kind];
  return (
    <div className={cx("m-design", scope === "mobile" && "is-mobile")} data-testid={TEST_IDS.designPanel}>
      <header className="m-design-head">
        <Icon className="m-design-head__icon" aria-hidden="true" />
        <span className="m-design-head__name">{inspect.name}</span>
        <span className="m-design-head__tag">{inspect.tag}</span>
      </header>
      <ScopeControl />
      {sectionsFor(kind).map((section) => {
        const fields = DESIGN_FIELDS.filter((f) => f.section === section);
        const overridden = scope === "all" ? [] : fields.filter((f) => fieldView(inspect, f.prop, scope).override);
        return (
          <Section key={section} title={SECTION_TITLES[section]} testId={`design-${section}`}>
            <div className="m-grid2">
              {fields.map((f) => {
                const view = fieldView(inspect, f.prop, scope);
                return (
                  <div key={f.prop} className={f.wide ? "is-wide" : undefined}>
                    <Field label={f.label} prefix={f.prefix} value={view.value} override={view.override}
                      mono={MONO.has(f.prop)} onCommit={(value) => { void actions.applyStyle(f.prop, value); }} />
                  </div>
                );
              })}
            </div>
            {overridden.map((f) => {
              const label = PROP_LABELS[f.prop];
              return (
                <div key={f.prop} className={cx("m-override-note", scope === "mobile" && "is-mobile")}>
                  <span><span className="m-dot" />{`${label.charAt(0).toUpperCase()}${label.slice(1)} set for ${SCOPE_LABELS[scope]}. Desktop: ${fieldView(inspect, f.prop, scope).desktop ?? "none"}`}</span>
                  <Button size="sm" variant="ghost" onClick={() => { void actions.resetStyle(f.prop); }}><RotateCcw size={12} />Reset</Button>
                </div>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
```

2. Create `tests/ui/design-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DesignPanel } from "../../src/ui/panels/DesignPanel.tsx";
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

describe("DesignPanel", () => {
  it("asks for a selection when nothing is selected", () => {
    renderWith(<DesignPanel />, { selection: null });
    expect(screen.getByTestId("design-panel")).toHaveTextContent("Select a layer to edit its style.");
  });
  it("shows the layer, the scope switch and the values at the scope", () => {
    renderWith(<DesignPanel />, { scope: "tablet" });
    const panel = screen.getByTestId("design-panel");
    expect(panel).toHaveTextContent("Headlineh1");
    expect(screen.getByTestId("scope-control")).toHaveTextContent("Tablet and smaller. Desktop keeps its own values.");
    expect(screen.getByLabelText("Font size")).toHaveValue("32px");
    expect(screen.getByLabelText("Font size").closest(".m-field")).toHaveClass("is-override");
    expect(within(screen.getByTestId("design-text")).getByText("Size set for ≤ 768. Desktop: 40px")).toBeInTheDocument();
  });
  it("applies an edited value and resets an override", async () => {
    const store = renderWith(<DesignPanel />, { scope: "tablet" });
    const size = screen.getByLabelText("Font size");
    await userEvent.clear(size);
    await userEvent.type(size, "30px{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(store.calls).toEqual([{ name: "applyStyle", args: ["font-size", "30px"] }, { name: "resetStyle", args: ["font-size"] }]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHILE nothing is selected THE SYSTEM SHALL ask for a selection. (test: "asks for a selection when nothing is selected")
- THE SYSTEM SHALL show values at the scope, override borders and "<Prop> set for ≤ 768. Desktop: <value>" notes. (test: "shows the layer, the scope switch and the values at the scope")
- WHEN a field is committed or Reset is clicked THE SYSTEM SHALL call applyStyle or resetStyle. (test: "applies an edited value and resets an override")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T043`.
The last line must be `GATE PASS T043`. On `GATE FAIL T043 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T043` prints `GATE PASS T043`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T043: Build the Design panel
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
