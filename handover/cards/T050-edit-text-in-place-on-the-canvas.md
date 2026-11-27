# T050: Edit text in place on the canvas

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T050 (build), phase 5 |
| Depends on | T049, T048 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R24 |

**Create:** `src/ui/canvas/TextEditor.tsx`, `tests/ui/text-editor.test.tsx`

**Modify:** `src/ui/canvas/canvas.css`, `src/ui/canvas/Canvas.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T050`):

1. `npx vitest run tests/ui/text-editor.test.tsx` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx vitest run tests/ui/canvas.test.tsx` -> exit 0, output contains `Tests  6 passed (6)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Double-clicking a text element on the open page opens a textarea over it with the element's font; Enter or blur saves through `editText`, Escape cancels.

## Context

UI module, canvas area. The editor lives inside the board's frame container, so it uses unscaled board pixels like the overlays. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

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

`src/ui/canvas/Canvas.tsx` (T027) renders boards with overlays and a hit layer. `src/ui/canvas/tools.ts` exports `editablePath`. `src/ui/canvas/dom-paths.ts` exports `elementAtPath`, `boxOf`.

## Steps

1. Create `src/ui/canvas/TextEditor.tsx` with exactly this content:

```tsx
import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ElementPath } from "../../contracts/model.ts";
import { boxOf, elementAtPath } from "./dom-paths.ts";
import "./canvas.css";

export interface TextEditorProps {
  frame: HTMLIFrameElement | null;
  path: ElementPath;
  onCommit(text: string): void;
  onClose(): void;
}
/**
 * Textarea over a text element inside a board, with the element's font. Enter (without Shift) or blur commits the
 * trimmed text when it changed; Escape closes without saving. Commits at most once.
 */
export function TextEditor({ frame, path, onCommit, onClose }: TextEditorProps) {
  const doc = frame?.contentDocument ?? null;
  const el = doc ? elementAtPath(doc, path) : null;
  const initial = (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const [text, setText] = useState(initial);
  const done = useRef(false);
  if (!el) return null;
  const box = boxOf(el);
  const cs = frame?.contentWindow?.getComputedStyle(el);
  const style: CSSProperties = {
    left: box.x, top: box.y, width: Math.max(box.width, 40), minHeight: box.height,
    fontFamily: cs?.fontFamily, fontSize: cs?.fontSize, fontWeight: cs?.fontWeight, lineHeight: cs?.lineHeight,
  };
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = text.replace(/\s+/g, " ").trim();
    if (save && next !== "" && next !== initial) onCommit(next);
    onClose();
  };
  return (
    <textarea
      className="m-text-editor" aria-label="Edit text" autoFocus value={text} style={style}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
      }}
    />
  );
}
```

2. Append these lines to the end of `src/ui/canvas/canvas.css`:

```css
.m-text-editor {
  position: absolute; z-index: 5; margin: 0; padding: 0; resize: none; overflow: hidden;
  border: 0; outline: calc(1.5px / var(--zoom)) solid var(--accent); background: #ffffff; color: #111110;
}
```

3. Replace the whole content of `src/ui/canvas/Canvas.tsx` with exactly:

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
import { TextEditor } from "./TextEditor.tsx";
import { boardPointerDown, boardPointerMove, editablePath, pathAtPoint } from "./tools.ts";
import "./canvas.css";

const INSERT_TOOL_IDS: readonly string[] = ["frame", "rect", "ellipse", "text", "image"];

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
  const [editing, setEditing] = useState<{ key: string; path: string } | null>(null);

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
        {editing?.key === key && (
          <TextEditor frame={frame} path={editing.path}
            onCommit={(text) => { void actions.editText(editing.path, text); }}
            onClose={() => setEditing(null)} />
        )}
        {tool !== "hand" && (
          <div
            className="m-board__hit"
            onPointerDown={(e) => { e.stopPropagation(); boardPointerDown(store.getState(), actions, pointer(e)); }}
            onPointerMove={(e) => boardPointerMove(store.getState(), actions, pointer(e))}
            onPointerLeave={() => { if (isOpen) actions.hover(null); }}
            onDoubleClick={(e) => {
              const path = editablePath(store.getState(), { page: info.name, board: bp.id, path: pathAtPoint(frames.current.get(key) ?? null, e.currentTarget, e.clientX, e.clientY, store.getState().zoom) });
              if (path !== null) setEditing({ key, path });
            }}
          />
        )}
      </Board>
    );
  };

  return (
    <div
      ref={root}
      className={cx("m-canvas", tool === "hand" && "is-hand", INSERT_TOOL_IDS.includes(tool) && "is-insert")}
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

4. Create `tests/ui/text-editor.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TextEditor } from "../../src/ui/canvas/TextEditor.tsx";


function frameWith(html: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  frame.contentDocument!.body.innerHTML = html;
  return frame;
}

describe("TextEditor", () => {
  it("commits changed text on Enter, once", () => {
    const frame = frameWith("<main><h1>Old  title</h1></main>");
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<TextEditor frame={frame} path="0.0" onCommit={onCommit} onClose={onClose} />);
    const box = screen.getByLabelText("Edit text");
    expect(box).toHaveValue("Old title");
    fireEvent.change(box, { target: { value: "New title" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("New title");
    expect(onClose).toHaveBeenCalledTimes(1);
    frame.remove();
  });
  it("closes without saving on Escape or when nothing changed", () => {
    const frame = frameWith("<main><h1>Same</h1></main>");
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(<TextEditor frame={frame} path="0.0" onCommit={onCommit} onClose={onClose} />);
    fireEvent.keyDown(screen.getByLabelText("Edit text"), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    frame.remove();
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- WHEN Enter is pressed with changed text THE SYSTEM SHALL commit it once and close. (test: "commits changed text on Enter, once")
- WHEN Escape is pressed or nothing changed THE SYSTEM SHALL close without saving. (test: "closes without saving on Escape or when nothing changed")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T050`.
The last line must be `GATE PASS T050`. On `GATE FAIL T050 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T050` prints `GATE PASS T050`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T050: Edit text in place on the canvas
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
