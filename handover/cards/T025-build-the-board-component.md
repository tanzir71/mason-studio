# T025: Build the board component

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T025 (build), phase 3 |
| Depends on | T022 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/canvas/canvas.css`, `src/ui/canvas/Board.tsx`, `tests/ui/board.test.tsx`

**Modify:** none

**Read only:** `src/ui/components/Button.tsx`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T025`):

1. `npx vitest run tests/ui/board.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`Board` shows one page at one breakpoint: label, live iframe of `/p/<file>?r=<revision>` and a slot for overlays.

## Context

UI module, canvas area. The canvas (T027) renders three boards per page. `canvas.css` holds every canvas style; sizes inside the zoomed content divide by `--zoom` so labels and outlines keep their screen size. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

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

```ts
// src/contracts/model.ts
export interface Breakpoint { id: BreakpointId; label: string; width: number; maxWidth: number | null }
export interface PageInfo { name: string; file: string; title: string; stylesheets: string[] }
```

## Current state

`src/ui/components/Button.tsx` exports `cx`. `src/ui/canvas/dom-paths.ts` may or may not exist yet; this card does not use it.

## Steps

1. Create `src/ui/canvas/canvas.css` with exactly this content:

```css
.m-canvas {
  position: relative; overflow: hidden; height: 100%; background: var(--bg-canvas);
  user-select: none; touch-action: none;
}
.m-canvas.is-hand { cursor: grab; }
.m-canvas.is-insert { cursor: crosshair; }
.m-canvas__content { position: absolute; left: 0; top: 0; transform-origin: 0 0; padding: 48px; }
.m-page-row { margin-bottom: 96px; }
.m-page-row__title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 24px; font: 600 calc(13px / var(--zoom)) / 1.3 var(--font-sans); color: var(--text-strong); }
.m-page-row__file { font: 400 calc(12px / var(--zoom)) / 1.3 var(--font-mono); color: var(--text-faint); }
.m-page-row.is-inactive { opacity: 0.72; }
.m-page-row__boards { display: flex; align-items: flex-start; gap: 48px; }

.m-board { flex: none; }
.m-board__label {
  display: inline-flex; align-items: center; gap: calc(6px / var(--zoom)); margin: 0 0 calc(8px / var(--zoom)); padding: 0;
  border: 0; background: transparent; color: var(--text-muted); font: 500 calc(12px / var(--zoom)) / 1.3 var(--font-sans);
}
.m-board__label .m-dot { width: calc(6px / var(--zoom)); height: calc(6px / var(--zoom)); }
.m-board.is-active .m-board__label { color: var(--text-strong); }
.m-board__width { font: 400 calc(11px / var(--zoom)) / 1.3 var(--font-mono); color: var(--text-faint); }
.m-board__frame { position: relative; background: #ffffff; box-shadow: 0 0 0 calc(1px / var(--zoom)) var(--border-default); }
.m-board.is-active .m-board__frame { box-shadow: 0 0 0 calc(1.5px / var(--zoom)) var(--accent); }
.m-board__frame iframe { display: block; border: 0; pointer-events: none; background: #ffffff; }
.m-board__hit { position: absolute; inset: 0; }

.m-ov { position: absolute; pointer-events: none; box-sizing: border-box; }
.m-ov--selection { border: calc(1.5px / var(--zoom)) solid var(--accent); }
.m-ov--hover { border: calc(1px / var(--zoom)) solid var(--accent-strong); }
.m-ov--mirror { border: calc(1px / var(--zoom)) dashed var(--accent-strong); }
.m-ov__size {
  position: absolute; left: 50%; top: 100%; transform: translate(-50%, calc(6px / var(--zoom)));
  padding: 0 calc(6px / var(--zoom)); border-radius: calc(4px / var(--zoom)); background: var(--accent); color: var(--accent-on);
  font: 500 calc(11px / var(--zoom)) / calc(18px / var(--zoom)) var(--font-mono); white-space: nowrap;
}

.m-zoom {
  position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 2px; padding: 2px;
  border: 1px solid var(--border-default); border-radius: var(--radius-8); background: var(--bg-panel); box-shadow: var(--shadow-float);
}
.m-zoom__value { min-width: 44px; text-align: center; font: var(--label-12); color: var(--text-default); }
```

2. Create `src/ui/canvas/Board.tsx` with exactly this content:

```tsx
import { useState } from "react";
import type { ReactNode } from "react";
import { TEST_IDS } from "../../contracts/ui.tsx";
import type { Breakpoint, PageInfo } from "../../contracts/model.ts";
import { cx } from "../components/Button.tsx";
import "./canvas.css";

export const DEFAULT_BOARD_HEIGHT = 900;
/** Board height from the loaded document: scrollHeight clamped to [400, 6000]. */
export function measureHeight(doc: Document | null): number {
  const h = doc?.documentElement?.scrollHeight ?? 0;
  return h > 0 ? Math.min(6000, Math.max(400, h)) : DEFAULT_BOARD_HEIGHT;
}

export interface BoardProps {
  page: PageInfo;
  bp: Breakpoint;
  revision: number;
  active: boolean;
  onActivate(): void;
  /** Called with the iframe after every load. */
  onFrame(frame: HTMLIFrameElement): void;
  /** Hit layer, overlays: rendered on top of the iframe, same size. */
  children?: ReactNode;
}
export function Board({ page, bp, revision, active, onActivate, onFrame, children }: BoardProps) {
  const [height, setHeight] = useState(DEFAULT_BOARD_HEIGHT);
  return (
    <div className={cx("m-board", active && "is-active")} data-testid={`${TEST_IDS.board}${page.name}-${bp.id}`}>
      <button type="button" className="m-board__label" onClick={onActivate}>
        <span className="m-dot" style={{ background: `var(--bp-${bp.id})` }} />
        {bp.label}
        <span className="m-board__width">{bp.maxWidth === null ? String(bp.width) : `≤ ${bp.maxWidth}`}</span>
      </button>
      <div className="m-board__frame" style={{ width: bp.width, height }}>
        <iframe
          key={revision}
          title={`${page.name} ${bp.label}`}
          src={`/p/${page.file}?r=${revision}`}
          width={bp.width}
          height={height}
          onLoad={(e) => {
            const frame = e.currentTarget;
            setHeight(measureHeight(frame.contentDocument));
            onFrame(frame);
          }}
        />
        {children}
      </div>
    </div>
  );
}
```

3. Create `tests/ui/board.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Board, measureHeight } from "../../src/ui/canvas/Board.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";

const page = { name: "Home", file: "index.html", title: "Home", stylesheets: [] };

describe("Board", () => {
  it("renders the label, the iframe and its children", () => {
    render(<Board page={page} bp={BREAKPOINTS[1]} revision={3} active onActivate={() => {}} onFrame={() => {}}><span>overlay</span></Board>);
    const board = screen.getByTestId("board-Home-tablet");
    expect(board).toHaveClass("m-board", "is-active");
    expect(board).toHaveTextContent("Tablet≤ 768");
    const frame = screen.getByTitle("Home Tablet");
    expect(frame).toHaveAttribute("src", "/p/index.html?r=3");
    expect(frame).toHaveAttribute("width", "768");
    expect(screen.getByText("overlay")).toBeInTheDocument();
  });
  it("activates on label click and reports the frame on load", () => {
    const onActivate = vi.fn();
    const onFrame = vi.fn();
    render(<Board page={page} bp={BREAKPOINTS[0]} revision={0} active={false} onActivate={onActivate} onFrame={onFrame} />);
    fireEvent.click(screen.getByRole("button", { name: /Desktop/ }));
    fireEvent.load(screen.getByTitle("Home Desktop"));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledWith(screen.getByTitle("Home Desktop"));
  });
  it("clamps the measured height", () => {
    const doc = (h: number) => ({ documentElement: { scrollHeight: h } } as unknown as Document);
    expect([measureHeight(null), measureHeight(doc(0)), measureHeight(doc(120)), measureHeight(doc(2400)), measureHeight(doc(9000))]).toEqual([900, 900, 400, 2400, 6000]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL render the board with test id `board-<page>-<breakpoint>`, its label and an iframe of `/p/<file>?r=<revision>`. (test: "renders the label, the iframe and its children")
- WHEN the iframe loads THE SYSTEM SHALL report it through onFrame. (test: "activates on label click and reports the frame on load")
- THE SYSTEM SHALL clamp the measured board height to 400..6000, default 900. (test: "clamps the measured height")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T025`.
The last line must be `GATE PASS T025`. On `GATE FAIL T025 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T025` prints `GATE PASS T025`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T025: Build the board component
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
