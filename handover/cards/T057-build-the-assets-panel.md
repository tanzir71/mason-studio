# T057: Build the Assets panel

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T057 (build), phase 6 |
| Depends on | T056, T030 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R25, R26 |

**Create:** `src/ui/panels/assets.css`, `src/ui/panels/AssetsPanel.tsx`, `tests/ui/assets-panel.test.tsx`

**Modify:** `src/ui/panels/LeftPanel.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T057`):

1. `npx vitest run tests/ui/assets-panel.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/ui/left-panel.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The Assets tab lists tokens grouped by type with swatches, imports a JSON file (format detected) and writes tokens.css.

## Context

UI module, panels area. Replaces the empty assets area of the left panel. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface Token {
  name: string;                 // dot path, e.g. "color.ink"
  type: TokenType;
  value: string;                // CSS text: "#1e2a22", "16px", "Fraunces, serif", "600", "1.5"
  alias: string | null;         // "color.ink" when $value was "{color.ink}", else null
  byBreakpoint: Partial<Record<BreakpointId, string>>; // from $extensions["dev.mason.breakpoints"]
}
export type TokenType = "color" | "dimension" | "fontFamily" | "fontWeight" | "number";
export type TokenFormat = "dtcg" | "tokens-studio";
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

`src/ui/panels/LeftPanel.tsx` (T030) shows this for the Assets tab:

```tsx
      ) : (
        <div className="m-panel-scroll" data-testid={TEST_IDS.assetsPanel} />
      )}
```

## Steps

1. Create `src/ui/panels/assets.css` with exactly this content:

```css
.m-assets-type { margin: var(--space-2) 0 2px; padding: 0 var(--space-3); font: var(--text-11); color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; }
.m-token { display: flex; align-items: center; gap: var(--space-2); height: 28px; padding: 0 var(--space-3); font: var(--text-12); color: var(--text-default); }
.m-token:hover { background: var(--bg-hover); }
.m-token__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-token__value { font: var(--code-11); color: var(--text-faint); max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-token__chip { display: grid; place-items: center; width: 16px; height: 16px; border-radius: var(--radius-4); background: var(--bg-raised); color: var(--text-faint); font: 600 9px/1 var(--font-sans); flex: none; }
.m-assets-empty { margin: 0; padding: var(--space-2) var(--space-3); font: var(--text-12); color: var(--text-muted); }
.m-assets-actions { display: flex; gap: var(--space-2); padding: var(--space-3); }
.m-file-button { position: relative; overflow: hidden; }
.m-file-button input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
```

2. Create `src/ui/panels/AssetsPanel.tsx` with exactly this content:

```tsx
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Token, TokenFormat, TokenType } from "../../contracts/model.ts";
import { Button } from "../components/Button.tsx";
import "./panels.css";
import "./assets.css";
import "./design.css";

const TYPE_TITLES: Record<TokenType, string> = { color: "Colors", dimension: "Sizes", fontFamily: "Fonts", fontWeight: "Weights", number: "Numbers" };
const TYPE_ORDER: readonly TokenType[] = ["color", "dimension", "fontFamily", "fontWeight", "number"];
const CHIPS: Record<Exclude<TokenType, "color">, string> = { dimension: "px", fontFamily: "Aa", fontWeight: "B", number: "#" };

/** "tokens-studio" when the JSON has $metadata or $themes, or any object with both "value" and "type" and no "$value"; else "dtcg". */
export function detectTokenFormat(json: string): TokenFormat {
  let root: unknown;
  try { root = JSON.parse(json); } catch { return "dtcg"; }
  if (typeof root !== "object" || root === null) return "dtcg";
  if ("$metadata" in root || "$themes" in root) return "tokens-studio";
  const walk = (v: unknown): boolean => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
    if ("value" in v && "type" in v && !("$value" in v)) return true;
    return Object.values(v).some(walk);
  };
  return walk(root) ? "tokens-studio" : "dtcg";
}

function TokenRow({ token }: { token: Token }) {
  return (
    <div className="m-token" data-token={token.name}>
      {token.type === "color"
        ? <span className="m-swatch" style={{ background: token.value }} />
        : <span className="m-token__chip" aria-hidden="true">{CHIPS[token.type]}</span>}
      <span className="m-token__name">{token.name}</span>
      <span className="m-token__value">{token.alias ? `→ ${token.alias}` : token.value}</span>
    </div>
  );
}

export function AssetsPanel() {
  const actions = useActions();
  const tokens = useStudio((s) => s.tokens);
  const list = tokens?.tokens ?? [];
  return (
    <div className="m-panel-scroll" data-testid={TEST_IDS.assetsPanel}>
      <div className="m-group">
        <div className="m-group__head">
          <h2 className="m-group__title">Tokens</h2>
          <span className="m-row__meta">{list.length}</span>
        </div>
        {list.length === 0 && <p className="m-assets-empty">No tokens.json yet. Import a DTCG or Tokens Studio file.</p>}
        {TYPE_ORDER.map((type) => {
          const ofType = list.filter((t) => t.type === type);
          if (ofType.length === 0) return null;
          return (
            <div key={type}>
              <h3 className="m-assets-type">{TYPE_TITLES[type]}</h3>
              {ofType.map((t) => <TokenRow key={t.name} token={t} />)}
            </div>
          );
        })}
      </div>
      <div className="m-assets-actions">
        <label className="m-btn m-btn--secondary m-file-button">
          Import tokens
          <input type="file" accept=".json,application/json" aria-label="Import tokens file"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              const json = await file.text();
              await actions.importTokens(detectTokenFormat(json), json);
            }} />
        </label>
        <Button variant="ghost" disabled={list.length === 0} onClick={() => { void actions.exportTokens(); }}>Write tokens.css</Button>
      </div>
    </div>
  );
}
```

3. Replace the whole content of `src/ui/panels/LeftPanel.tsx` with exactly:

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { IconButton, cx } from "../components/Button.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { LayersTree } from "./LayersTree.tsx";
import { AssetsPanel } from "./AssetsPanel.tsx";
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
        <AssetsPanel />
      )}
    </aside>
  );
}
```

4. Create `tests/ui/assets-panel.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AssetsPanel, detectTokenFormat } from "../../src/ui/panels/AssetsPanel.tsx";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tokens = parseDtcg(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"), "tokens.json");
const renderPanel = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", tokens, ...state });
  render(<StudioContext.Provider value={store}><AssetsPanel /></StudioContext.Provider>);
  return store;
};

describe("AssetsPanel", () => {
  it("detects the token file format", () => {
    expect(detectTokenFormat(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"))).toBe("dtcg");
    expect(detectTokenFormat('{ "core": { "a": { "value": "#000", "type": "color" } } }')).toBe("tokens-studio");
    expect(detectTokenFormat('{ "$metadata": {} }')).toBe("tokens-studio");
    expect(detectTokenFormat("nope")).toBe("dtcg");
  });
  it("groups tokens by type with swatches and values", () => {
    renderPanel();
    const panel = screen.getByTestId("assets-panel");
    expect(within(panel).getByText("Colors")).toBeInTheDocument();
    expect(within(panel).getByText("Fonts")).toBeInTheDocument();
    const ink = panel.querySelector('[data-token="color.ink"]')!;
    expect(ink).toHaveTextContent("color.ink#1e2a22");
    expect((ink.querySelector(".m-swatch") as HTMLElement).style.background).not.toBe("");
  });
  it("explains the empty state", () => {
    renderPanel({ tokens: { tokens: [], file: null } });
    expect(screen.getByText("No tokens.json yet. Import a DTCG or Tokens Studio file.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write tokens.css" })).toBeDisabled();
  });
  it("imports a chosen file with the detected format and writes tokens.css", async () => {
    const store = renderPanel();
    const json = '{ "core": { "a": { "value": "#000000", "type": "color" } } }';
    await userEvent.upload(screen.getByLabelText("Import tokens file"), new File([json], "tokens.json", { type: "application/json" }));
    await waitFor(() => expect(store.calls).toEqual([{ name: "importTokens", args: ["tokens-studio", json] }]));
    await userEvent.click(screen.getByRole("button", { name: "Write tokens.css" }));
    expect(store.calls[1]).toEqual({ name: "exportTokens", args: [] });
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL detect Tokens Studio files by $metadata, $themes or value/type objects. (test: "detects the token file format")
- THE SYSTEM SHALL group tokens by type with color swatches. (test: "groups tokens by type with swatches and values")
- WHEN a file is chosen THE SYSTEM SHALL call importTokens with the detected format and the file text. (test: "imports a chosen file with the detected format and writes tokens.css")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T057`.
The last line must be `GATE PASS T057`. On `GATE FAIL T057 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T057` prints `GATE PASS T057`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T057: Build the Assets panel
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
