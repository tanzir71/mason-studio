# T027: Build the canvas with page rows, zoom and pan

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T027 (build), phase 3 |
| Depends on | T020, T026 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/canvas/tools.ts`, `src/ui/canvas/Canvas.tsx`, `tests/ui/canvas.test.tsx`

**Modify:** none

**Read only:** `src/ui/canvas/Board.tsx`, `src/ui/canvas/Overlay.tsx`, `src/ui/canvas/dom-paths.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T027`):

1. `npx vitest run tests/ui/canvas.test.tsx` -> exit 0, output contains `Tests  6 passed (6)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`Canvas` shows a row of Desktop/Tablet/Mobile boards for every page, selects and hovers through a hit layer, zooms, pans and draws the overlays.

## Context

UI module, canvas area. Pointer logic lives in `tools.ts` so phase 5 can add the insert tools there without touching `Canvas.tsx`. The open page's boards show the hover outline, the selection on the active board and dashed mirrors on the other two. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export interface StudioState {
  screen: "start" | "canvas";
  project: ProjectInfo | null;
  recent: RecentProject[];
  templates: TemplateInfo[];
  page: string | null;              // PageInfo.name of the open page
  tree: ElementNode | null;         // body of the open page
  selection: ElementPath | null;
  hover: ElementPath | null;
  scope: Scope;
  activeBoard: BreakpointId;
  tool: ToolId;
  leftTab: LeftTab;
  rightTab: RightTab;
  zoom: number;                     // 0.1 .. 2
  pan: { x: number; y: number };
  inspect: InspectResult | null;    // for `selection`
  tokens: TokenSet | null;
  checks: CheckReport | null;
  contrast: CheckFinding[];         // computed in the browser from board iframes
  proposals: Proposal[];
  code: CodeState;
  git: GitStatus | null;
  settings: Settings | null;
  settingsOpen: boolean;
  agentPrompt: { open: boolean; busy: boolean };
  toast: Toast | null;
  revision: number;                 // boards reload when it changes
  busy: boolean;                    // true while a write is in flight
}
export const StudioContext = createContext<StudioStore | null>(null);
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

`src/ui/canvas/` has `dom-paths.ts`, `canvas.css`, `Board.tsx` (`Board`, `measureHeight`) and `Overlay.tsx`. `src/ui/components/Button.tsx` exports `IconButton` and `cx`.

## Steps

1. Create `src/ui/canvas/tools.ts` with exactly this content:

```ts
import type { BreakpointId, ElementPath } from "../../contracts/model.ts";
import type { StudioActions, StudioState } from "../../contracts/ui.tsx";
import { pathOf } from "./dom-paths.ts";

/** Width of one page row at zoom 1: the three boards plus two 48px gaps plus 48px padding on both sides. */
export const ROW_WIDTH = 1280 + 768 + 375 + 2 * 48 + 2 * 48;
/** Zoom that fits a page row into `width` pixels, clamped to [0.1, 2], 2 decimals. */
export function fitZoom(width: number): number {
  return Math.round(Math.min(2, Math.max(0.1, width / ROW_WIDTH)) * 100) / 100;
}

/** Element path under a pointer event on a board's hit layer, or null. */
export function pathAtPoint(frame: HTMLIFrameElement | null, hit: HTMLElement, clientX: number, clientY: number, zoom: number): ElementPath | null {
  const doc = frame?.contentDocument;
  if (!doc) return null;
  const r = hit.getBoundingClientRect();
  const el = doc.elementFromPoint((clientX - r.left) / zoom, (clientY - r.top) / zoom);
  return el ? pathOf(el) : null;
}

export interface BoardPointer { page: string; board: BreakpointId; path: ElementPath | null }

/** Pointer down on a board. Another page → selectPage. Move tool → activate the board and select the path. */
export function boardPointerDown(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page !== p.page) { void actions.selectPage(p.page); return; }
  if (state.tool === "move") {
    if (state.activeBoard !== p.board) actions.setActiveBoard(p.board);
    actions.select(p.path);
  }
}

/** Pointer move on a board: hover follows the pointer with the move tool on the open page. */
export function boardPointerMove(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page === p.page && state.tool === "move") actions.hover(p.path);
}
```

2. Create `src/ui/canvas/Canvas.tsx` with exactly this content:

```tsx
import { useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { StudioContext, TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { BREAKPOINTS } from "../../contracts/model.ts";
import type { Breakpoint, PageInfo } from "../../contracts/model.ts";
import { IconButton, cx } from "../components/Button.tsx";
import { Board } from "./Board.tsx";
import { Overlay } from "./Overlay.tsx";
import { boardPointerDown, boardPointerMove, pathAtPoint } from "./tools.ts";
import "./canvas.css";

const INSERT_TOOLS = ["frame", "rect", "ellipse", "text", "image"];

export function Canvas() {
  const store = useContext(StudioContext)!;
  const actions = useActions();
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const revision = useStudio((s) => s.revision);
  const zoom = useStudio((s) => s.zoom);
  const pan = useStudio((s) => s.pan);
  const tool = useStudio((s) => s.tool);
  const selection = useStudio((s) => s.selection);
  const hover = useStudio((s) => s.hover);
  const activeBoard = useStudio((s) => s.activeBoard);
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const [loads, setLoads] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = store.getState();
      if (e.ctrlKey || e.metaKey) actions.setZoom(s.zoom * (1 - e.deltaY * 0.01));
      else actions.panBy(-e.deltaX, -e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [store, actions]);

  if (!project) return null;
  const version = `${loads}:${revision}:${zoom}`;

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "hand" && e.button !== 1) return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    actions.panBy(e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => { drag.current = null; };

  const renderBoard = (info: PageInfo, bp: Breakpoint) => {
    const key = `${info.name}-${bp.id}`;
    const isOpen = info.name === page;
    const frame = frames.current.get(key) ?? null;
    const pointer = (e: ReactPointerEvent<HTMLDivElement>) => ({
      page: info.name, board: bp.id,
      path: pathAtPoint(frames.current.get(key) ?? null, e.currentTarget, e.clientX, e.clientY, store.getState().zoom),
    });
    return (
      <Board
        key={key} page={info} bp={bp} revision={revision} active={isOpen && activeBoard === bp.id}
        onActivate={() => { if (isOpen) actions.setActiveBoard(bp.id); else void actions.selectPage(info.name); }}
        onFrame={(f) => { frames.current.set(key, f); setLoads((n) => n + 1); }}
      >
        {isOpen && (
          <>
            <Overlay frame={frame} path={hover} kind="hover" version={version} />
            <Overlay frame={frame} path={selection} kind={activeBoard === bp.id ? "selection" : "mirror"} version={version} />
          </>
        )}
        {tool !== "hand" && (
          <div
            className="m-board__hit"
            onPointerDown={(e) => { e.stopPropagation(); boardPointerDown(store.getState(), actions, pointer(e)); }}
            onPointerMove={(e) => boardPointerMove(store.getState(), actions, pointer(e))}
            onPointerLeave={() => { if (isOpen) actions.hover(null); }}
          />
        )}
      </Board>
    );
  };

  return (
    <div
      ref={root}
      className={cx("m-canvas", tool === "hand" && "is-hand", INSERT_TOOLS.includes(tool) && "is-insert")}
      data-testid={TEST_IDS.canvas}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="m-canvas__content" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, "--zoom": zoom } as CSSProperties}>
        {project.pages.map((info) => (
          <section key={info.name} className={cx("m-page-row", info.name !== page && "is-inactive")}>
            <h2 className="m-page-row__title">{info.name}<span className="m-page-row__file">{info.file}</span></h2>
            <div className="m-page-row__boards">{BREAKPOINTS.map((bp) => renderBoard(info, bp))}</div>
          </section>
        ))}
      </div>
      <div className="m-zoom">
        <IconButton label="Zoom out" onClick={() => actions.setZoom(zoom - 0.1)}><Minus /></IconButton>
        <span className="m-zoom__value">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => actions.setZoom(zoom + 0.1)}><Plus /></IconButton>
      </div>
    </div>
  );
}
```

3. Create `tests/ui/canvas.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Canvas } from "../../src/ui/canvas/Canvas.tsx";
import { boardPointerDown, boardPointerMove, fitZoom, ROW_WIDTH } from "../../src/ui/canvas/tools.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};

describe("Canvas", () => {
  it("renders a row of three boards per page", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    for (const id of ["Home-desktop", "Home-tablet", "Home-mobile", "Menu-desktop", "Menu-tablet", "Menu-mobile"]) {
      expect(screen.getByTestId(`board-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Menumenu.html" })).toBeInTheDocument();
    expect(screen.getByTestId("board-Home-desktop")).toHaveClass("is-active");
    expect(screen.getByTestId("board-Menu-desktop")).not.toHaveClass("is-active");
  });
  it("applies zoom and pan and shows the zoom value", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", zoom: 0.5, pan: { x: 10, y: 20 } });
    const { container } = render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    expect(container.querySelector(".m-canvas__content")).toHaveStyle({ transform: "translate(10px, 20px) scale(0.5)" });
    expect(screen.getByText("50%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(store.calls.map((c) => [c.name, Math.round((c.args[0] as number) * 100)])).toEqual([["setZoom", 60], ["setZoom", 40]]);
  });
  it("activates a board of the open page and opens another page from its label", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    fireEvent.click(screen.getByTestId("board-Home-mobile").querySelector("button")!);
    fireEvent.click(screen.getByTestId("board-Menu-tablet").querySelector("button")!);
    expect(store.calls).toEqual([{ name: "setActiveBoard", args: ["mobile"] }, { name: "selectPage", args: ["Menu"] }]);
  });
  it("renders nothing without a project", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><Canvas /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});

describe("canvas tools", () => {
  it("fits the page row into a width", () => {
    expect(ROW_WIDTH).toBe(2615);
    expect([fitZoom(900), fitZoom(100), fitZoom(99999)]).toEqual([0.34, 0.1, 2]);
  });
  it("selects with the move tool and opens other pages", () => {
    const store = createFakeStore({ page: "Home", tool: "move", activeBoard: "desktop" });
    boardPointerDown(store.getState(), store.actions, { page: "Home", board: "tablet", path: "1.0" });
    boardPointerDown(store.getState(), store.actions, { page: "Menu", board: "desktop", path: "0" });
    boardPointerMove(store.getState(), store.actions, { page: "Home", board: "tablet", path: "1" });
    boardPointerMove(store.getState(), store.actions, { page: "Menu", board: "tablet", path: "1" });
    expect(store.calls).toEqual([
      { name: "setActiveBoard", args: ["tablet"] }, { name: "select", args: ["1.0"] },
      { name: "selectPage", args: ["Menu"] }, { name: "hover", args: ["1"] },
    ]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL render a row of three boards for every page, marking the active board of the open page. (test: "renders a row of three boards per page")
- THE SYSTEM SHALL apply `translate(pan) scale(zoom)` and step zoom by 0.1 from the zoom control. (test: "applies zoom and pan and shows the zoom value")
- WHEN a board of another page is used THE SYSTEM SHALL open that page; with the move tool on the open page it SHALL select. (test: "selects with the move tool and opens other pages")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T027`.
The last line must be `GATE PASS T027`. On `GATE FAIL T027 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T027` prints `GATE PASS T027`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T027: Build the canvas with page rows, zoom and pan
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
