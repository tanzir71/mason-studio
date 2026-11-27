# T026: Draw selection, hover and mirror outlines

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T026 (build), phase 3 |
| Depends on | T024, T025 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/canvas/Overlay.tsx`, `tests/ui/overlay.test.tsx`

**Modify:** none

**Read only:** `src/ui/canvas/dom-paths.ts`, `src/ui/canvas/canvas.css`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T026`):

1. `npx vitest run tests/ui/overlay.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`Overlay` outlines the element at a path inside a board, with a `W × H` label for the selection.

## Context

UI module, canvas area. The canvas places overlays inside each board's frame container, so boxes use unscaled board pixels from `getBoundingClientRect` inside the iframe. Styles `.m-ov*` are already in `canvas.css` (T025). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

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
/**
 * Element path: dot-separated indexes of ELEMENT children, starting at <body>.
 * "" is <body>; "0" is body's first element child; "0.2" is that element's third element child.
 * Every element child counts (script, style, template too). Text and comment nodes never count.
 * The browser (`Element.children`) and the server (parse5 element children) give identical paths.
 */
export type ElementPath = string;
```

## Current state

`src/ui/canvas/dom-paths.ts` exports `elementAtPath(doc, path)`, `pathOf(el)`, `boxOf(el)` (rounded x, y, width, height).

## Steps

1. Create `src/ui/canvas/Overlay.tsx` with exactly this content:

```tsx
import { TEST_IDS } from "../../contracts/ui.tsx";
import type { ElementPath } from "../../contracts/model.ts";
import { boxOf, elementAtPath } from "./dom-paths.ts";

export interface OverlayProps {
  frame: HTMLIFrameElement | null;
  path: ElementPath | null;
  kind: "selection" | "hover" | "mirror";
  /** Any value that changes when the box must be measured again (loads, revision, zoom). */
  version: string;
}
/** Outline of the element at `path` inside `frame`, in unscaled board pixels. Renders nothing when not found. */
export function Overlay({ frame, path, kind, version }: OverlayProps) {
  void version;
  const doc = frame?.contentDocument ?? null;
  if (!doc || path === null) return null;
  const el = elementAtPath(doc, path);
  if (!el) return null;
  const box = boxOf(el);
  const testId = kind === "selection" ? TEST_IDS.selection : kind === "mirror" ? TEST_IDS.mirror : undefined;
  return (
    <div className={`m-ov m-ov--${kind}`} data-testid={testId} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
      {kind === "selection" && <span className="m-ov__size">{`${box.width} × ${box.height}`}</span>}
    </div>
  );
}
```

2. Create `tests/ui/overlay.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Overlay } from "../../src/ui/canvas/Overlay.tsx";

function frameWith(html: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  frame.contentDocument!.body.innerHTML = html;
  return frame;
}

describe("Overlay", () => {
  it("draws the selection box with its size", () => {
    const frame = frameWith("<header></header><main><h1>Hi</h1></main>");
    const h1 = frame.contentDocument!.querySelector("h1")!;
    h1.getBoundingClientRect = () => ({ left: 64, top: 120.4, width: 420, height: 70 } as DOMRect);
    render(<Overlay frame={frame} path="1.0" kind="selection" version="1" />);
    const box = screen.getByTestId("overlay-selection");
    expect(box).toHaveClass("m-ov", "m-ov--selection");
    expect(box).toHaveStyle({ left: "64px", top: "120px", width: "420px", height: "70px" });
    expect(box).toHaveTextContent("420 × 70");
    frame.remove();
  });
  it("draws mirrors without a size label", () => {
    const frame = frameWith("<main></main>");
    render(<Overlay frame={frame} path="0" kind="mirror" version="1" />);
    expect(screen.getByTestId("overlay-mirror")).toHaveTextContent("");
    frame.remove();
  });
  it("renders nothing without a frame, a path or a matching element", () => {
    const frame = frameWith("<main></main>");
    const { container } = render(<><Overlay frame={null} path="0" kind="hover" version="1" /><Overlay frame={frame} path={null} kind="hover" version="1" /><Overlay frame={frame} path="4" kind="hover" version="1" /></>);
    expect(container.innerHTML).toBe("");
    frame.remove();
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL draw the selection box at the element's rounded box with a `W × H` label. (test: "draws the selection box with its size")
- THE SYSTEM SHALL render nothing without a frame, a path or a matching element. (test: "renders nothing without a frame, a path or a matching element")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T026`.
The last line must be `GATE PASS T026`. On `GATE FAIL T026 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T026` prints `GATE PASS T026`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T026: Draw selection, hover and mirror outlines
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
