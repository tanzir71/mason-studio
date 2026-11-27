# T042: Build the design field map and the scope switch

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T042 (build), phase 4 |
| Depends on | T023 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R19, R23 |

**Create:** `src/ui/panels/design.css`, `src/ui/panels/design-fields.ts`, `src/ui/panels/ScopeControl.tsx`, `tests/ui/design-fields.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T042`):

1. `npx vitest run tests/ui/design-fields.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`DESIGN_FIELDS`, `fieldView`, `nodeAt` and the "Applies to" `ScopeControl` exist.

## Context

UI module, panels area. `design.css` holds the Design panel styles. Values shown always come from the breakpoint of the current scope (All sizes → desktop). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export const INSPECT_PROPS = [
  "display", "flex-direction", "gap", "justify-content", "align-items", "grid-template-columns",
  "width", "height", "max-width", "padding", "margin",
  "font-family", "font-weight", "font-size", "line-height", "letter-spacing", "text-align",
  "color", "background-color", "border", "border-radius", "opacity", "box-shadow",
] as const;
/** Breakpoint whose width is used to evaluate an edit scope. */
export const SCOPE_BREAKPOINT: Record<Scope, BreakpointId> = { all: "desktop", tablet: "tablet", mobile: "mobile" };
export interface PropInfo {
  values: Record<BreakpointId, string | null>;      // winning declared value at each breakpoint width
  winners: Record<BreakpointId, RuleRef | null>;    // rule of that winning declaration
  overriddenAt: BreakpointId[];                     // tablet/mobile whose winner sits in "(max-width: <that maxWidth>px)"
}
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

`src/ui/components/Tabs.tsx` exports `Tabs` (with the segmented variant).

## Steps

1. Create `src/ui/panels/design.css` with exactly this content:

```css
.m-design-head { display: flex; align-items: center; gap: var(--space-2); height: 44px; padding: 0 var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.m-design-head__icon { width: 16px; height: 16px; color: var(--accent-strong); flex: none; }
.m-design-head__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--title-13); color: var(--text-strong); }
.m-design-head__tag { font: var(--code-11); color: var(--text-faint); }
.m-scope { display: grid; gap: var(--space-2); padding: var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.m-scope__label { font: var(--text-11); color: var(--text-muted); }
.m-scope__note { margin: 0; font: var(--text-12); color: var(--text-muted); }
.m-grid2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2); }
.m-grid2 > * { min-width: 0; }
.m-grid2 > .is-wide { grid-column: 1 / -1; }
.m-override-note { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); font: var(--text-12); color: var(--text-muted); }
.m-override-note .m-dot { margin-right: 6px; background: var(--bp-tablet); }
.m-override-note.is-mobile .m-dot { background: var(--bp-mobile); }
.m-swatch { width: 16px; height: 16px; border-radius: var(--radius-4); box-shadow: inset 0 0 0 1px var(--border-default); flex: none; }
.m-empty { padding: var(--space-5) var(--space-3); font: var(--text-12); color: var(--text-muted); text-align: center; }
.m-design.is-mobile .m-field.is-override { border-color: var(--bp-mobile); }
```

2. Create `src/ui/panels/design-fields.ts` with exactly this content:

```ts
import { SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { BreakpointId, ElementNode, ElementPath, InspectProp, InspectResult, LayerKind, Scope } from "../../contracts/model.ts";

export type DesignSectionId = "layout" | "text" | "fill" | "stroke" | "effects";
export interface DesignField { prop: InspectProp; prefix: string; label: string; section: DesignSectionId; wide?: boolean }

/** Every field of the Design panel, in display order. `label` is the input's accessible name. */
export const DESIGN_FIELDS: readonly DesignField[] = [
  { prop: "display", prefix: "Display", label: "Display", section: "layout" },
  { prop: "flex-direction", prefix: "Dir", label: "Direction", section: "layout" },
  { prop: "width", prefix: "W", label: "Width", section: "layout" },
  { prop: "height", prefix: "H", label: "Height", section: "layout" },
  { prop: "max-width", prefix: "Max W", label: "Max width", section: "layout" },
  { prop: "gap", prefix: "Gap", label: "Gap", section: "layout" },
  { prop: "padding", prefix: "Pad", label: "Padding", section: "layout" },
  { prop: "margin", prefix: "Margin", label: "Margin", section: "layout" },
  { prop: "justify-content", prefix: "Justify", label: "Justify", section: "layout" },
  { prop: "align-items", prefix: "Items", label: "Align items", section: "layout" },
  { prop: "grid-template-columns", prefix: "Columns", label: "Columns", section: "layout", wide: true },
  { prop: "font-family", prefix: "Font", label: "Font", section: "text", wide: true },
  { prop: "font-weight", prefix: "Weight", label: "Weight", section: "text" },
  { prop: "font-size", prefix: "Size", label: "Font size", section: "text" },
  { prop: "line-height", prefix: "Line", label: "Line height", section: "text" },
  { prop: "letter-spacing", prefix: "Letter", label: "Letter spacing", section: "text" },
  { prop: "text-align", prefix: "Align", label: "Text align", section: "text" },
  { prop: "color", prefix: "Color", label: "Text color", section: "text", wide: true },
  { prop: "background-color", prefix: "Fill", label: "Fill", section: "fill", wide: true },
  { prop: "border", prefix: "Stroke", label: "Stroke", section: "stroke", wide: true },
  { prop: "border-radius", prefix: "Radius", label: "Radius", section: "stroke", wide: true },
  { prop: "opacity", prefix: "Opacity", label: "Opacity", section: "effects" },
  { prop: "box-shadow", prefix: "Shadow", label: "Shadow", section: "effects", wide: true },
];

export const SECTION_TITLES: Record<DesignSectionId, string> = { layout: "Layout", text: "Text", fill: "Fill", stroke: "Stroke", effects: "Effects" };

/** Sections shown for a layer kind: text and link layers get the Text section, others do not. */
export function sectionsFor(kind: LayerKind): DesignSectionId[] {
  return kind === "text" || kind === "link" ? ["layout", "text", "fill", "stroke", "effects"] : ["layout", "fill", "stroke", "effects"];
}

export const SCOPE_LABELS: Record<Scope, string> = { all: "All sizes", tablet: "≤ 768", mobile: "≤ 375" };
export const SCOPE_NOTES: Record<Scope, string> = {
  all: "Edits the base rule. Every size inherits it.",
  tablet: "Tablet and smaller. Desktop keeps its own values.",
  mobile: "Phones only. Tablet and desktop keep their own values.",
};

export interface FieldView { value: string; override: boolean; desktop: string | null }
/** Value shown for a field at the scope's breakpoint, whether it is an override there, and the desktop value. */
export function fieldView(inspect: InspectResult, prop: InspectProp, scope: Scope): FieldView {
  const info = inspect.props[prop];
  const bp: BreakpointId = SCOPE_BREAKPOINT[scope];
  return { value: info.values[bp] ?? "", override: info.overriddenAt.includes(bp), desktop: info.values.desktop };
}

/** The node at `path` in a page tree ("" = body), or null. */
export function nodeAt(tree: ElementNode, path: ElementPath): ElementNode | null {
  if (path === "") return tree;
  let n: ElementNode | undefined = tree;
  for (const seg of path.split(".")) { n = n?.children[Number(seg)]; if (!n) return null; }
  return n ?? null;
}
```

3. Create `src/ui/panels/ScopeControl.tsx` with exactly this content:

```tsx
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Scope } from "../../contracts/model.ts";
import { Tabs } from "../components/Tabs.tsx";
import { SCOPE_LABELS, SCOPE_NOTES } from "./design-fields.ts";
import "./design.css";

const ITEMS: readonly { id: Scope; label: string; dot?: string }[] = [
  { id: "all", label: SCOPE_LABELS.all },
  { id: "tablet", label: SCOPE_LABELS.tablet, dot: "var(--bp-tablet)" },
  { id: "mobile", label: SCOPE_LABELS.mobile, dot: "var(--bp-mobile)" },
];

/** "Applies to" switch: which breakpoint the next edit writes to. */
export function ScopeControl() {
  const actions = useActions();
  const scope = useStudio((s) => s.scope);
  return (
    <div className="m-scope" data-testid={TEST_IDS.scopeControl}>
      <span className="m-scope__label">Applies to</span>
      <Tabs<Scope> variant="segmented" label="Applies to" value={scope} onChange={actions.setScope} items={ITEMS} />
      <p className="m-scope__note">{SCOPE_NOTES[scope]}</p>
    </div>
  );
}
```

4. Create `tests/ui/design-fields.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ScopeControl } from "../../src/ui/panels/ScopeControl.tsx";
import { DESIGN_FIELDS, fieldView, nodeAt, sectionsFor } from "../../src/ui/panels/design-fields.ts";
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

describe("design fields", () => {
  it("covers every inspect property once", () => {
    expect(DESIGN_FIELDS.map((f) => f.prop).sort()).toEqual([...INSPECT_PROPS].sort());
  });
  it("shows text sections only for text and links", () => {
    expect(sectionsFor("text")).toContain("text");
    expect(sectionsFor("frame")).not.toContain("text");
  });
  it("reads the value at the scope breakpoint", () => {
    expect(fieldView(inspect, "font-size", "tablet")).toEqual({ value: "32px", override: true, desktop: "40px" });
    expect(fieldView(inspect, "font-size", "all")).toEqual({ value: "40px", override: false, desktop: "40px" });
    expect(fieldView(inspect, "padding", "all").value).toBe("");
    expect(nodeAt(tree, "0.0")!.kind).toBe("text");
    expect(nodeAt(tree, "3")).toBeNull();
  });
  it("changes the scope from the switch", async () => {
    const store = renderWith(<ScopeControl />);
    await userEvent.click(screen.getByRole("tab", { name: "≤ 375" }));
    expect(store.calls).toEqual([{ name: "setScope", args: ["mobile"] }]);
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL map every INSPECT_PROPS property to exactly one field. (test: "covers every inspect property once")
- THE SYSTEM SHALL show the value at the scope's breakpoint and flag overrides. (test: "reads the value at the scope breakpoint")
- WHEN a scope tab is clicked THE SYSTEM SHALL call setScope. (test: "changes the scope from the switch")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T042`.
The last line must be `GATE PASS T042`. On `GATE FAIL T042 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T042` prints `GATE PASS T042`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T042: Build the design field map and the scope switch
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
