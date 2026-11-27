# T031: Build the tool dock, toast and keyboard shortcuts

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T031 (build), phase 3 |
| Depends on | T027, T028 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15, R17 |

**Create:** `src/ui/app/shortcuts.ts`, `src/ui/app/Toast.tsx`, `src/ui/app/ToolDock.tsx`, `tests/ui/dock-shortcuts.test.tsx`

**Modify:** none

**Read only:** `src/ui/canvas/tools.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T031`):

1. `npx vitest run tests/ui/dock-shortcuts.test.tsx` -> exit 0, output contains `Tests  7 passed (7)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The floating tool dock, the toast with Undo and the SHORTCUTS keyboard map work.

## Context

UI module, app area. Shortcuts follow the contract table exactly; they never fire while typing in an input. Styles `.m-dock*` and `.m-toast*` are in `app.css` (T028). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
export type ToolId = "move" | "frame" | "rect" | "ellipse" | "text" | "image" | "hand";
export type ShortcutAction =
  | "tool:move" | "tool:frame" | "tool:rect" | "tool:ellipse" | "tool:text" | "tool:image" | "tool:hand"
  | "wrap" | "agent" | "code" | "undo" | "redo" | "delete" | "deselect" | "zoom:fit" | "zoom:in" | "zoom:out";
/** "mod" = Ctrl on Windows/Linux, Cmd on macOS. Keys are lowercase KeyboardEvent.key values joined with "+". */
export const SHORTCUTS: readonly { keys: string; action: ShortcutAction }[] = [
  { keys: "v", action: "tool:move" }, { keys: "f", action: "tool:frame" }, { keys: "a", action: "tool:frame" },
  { keys: "r", action: "tool:rect" }, { keys: "o", action: "tool:ellipse" }, { keys: "t", action: "tool:text" },
  { keys: "shift+mod+k", action: "tool:image" }, { keys: "h", action: "tool:hand" }, { keys: "shift+a", action: "wrap" },
  { keys: "mod+i", action: "agent" }, { keys: "mod+e", action: "code" }, { keys: "mod+z", action: "undo" },
  { keys: "shift+mod+z", action: "redo" }, { keys: "delete", action: "delete" }, { keys: "backspace", action: "delete" },
  { keys: "escape", action: "deselect" }, { keys: "shift+1", action: "zoom:fit" }, { keys: "mod+=", action: "zoom:in" },
  { keys: "mod+-", action: "zoom:out" },
];
export interface StudioStore {
  getState(): StudioState;
  setState(patch: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)): void;
  subscribe(listener: () => void): () => void;
  actions: StudioActions;
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

## Current state

`src/ui/canvas/tools.ts` exports `fitZoom(width)`. `src/ui/app/app.css` exists. `src/ui/components/Button.tsx` exports `Button` and `IconButton`.

## Steps

1. Create `src/ui/app/shortcuts.ts` with exactly this content:

```ts
import { useEffect } from "react";
import { SHORTCUTS } from "../../contracts/ui.tsx";
import type { ShortcutAction, StudioStore } from "../../contracts/ui.tsx";
import { fitZoom } from "../canvas/tools.ts";

export interface KeyLike { key: string; code?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

/** "shift", then "mod" (Cmd on macOS, Ctrl elsewhere), then the lowercase key; Digit codes give the digit (shift+1). */
export function comboOf(e: KeyLike, isMac: boolean): string {
  const parts: string[] = [];
  if (e.shiftKey) parts.push("shift");
  if (isMac ? e.metaKey : e.ctrlKey) parts.push("mod");
  const digit = /^Digit(\d)$/.exec(e.code ?? "");
  parts.push(digit ? digit[1] : e.key.toLowerCase());
  return parts.join("+");
}

/** The shortcut action for a key event, or null. Alt combinations never match. */
export function matchShortcut(e: KeyLike, isMac: boolean): ShortcutAction | null {
  if (e.altKey) return null;
  const combo = comboOf(e, isMac);
  return SHORTCUTS.find((s) => s.keys === combo)?.action ?? null;
}

/** Runs one shortcut action against the store. */
export function runShortcut(action: ShortcutAction, store: StudioStore, viewportWidth: number): void {
  const { actions } = store;
  const state = store.getState();
  if (action.startsWith("tool:")) { actions.setTool(action.slice(5) as Parameters<typeof actions.setTool>[0]); return; }
  switch (action) {
    case "wrap": if (state.selection) void actions.wrapSelected(); break;
    case "agent": actions.openAgentPrompt(); break;
    case "code": {
      const info = state.project?.pages.find((p) => p.name === state.page);
      if (info) void actions.openCode(info.file, null);
      break;
    }
    case "undo": void actions.undo(); break;
    case "redo": void actions.redo(); break;
    case "delete": if (state.selection) void actions.removeSelected(); break;
    case "deselect": actions.select(null); break;
    case "zoom:fit": actions.setZoom(fitZoom(viewportWidth)); break;
    case "zoom:in": actions.setZoom(state.zoom + 0.1); break;
    case "zoom:out": actions.setZoom(state.zoom - 0.1); break;
  }
}

/** True when the key event comes from a text input, textarea, select or editable content. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable === true;
}

/** Window keydown listener: matched shortcuts run and the default action is prevented. */
export function useShortcuts(store: StudioStore): void {
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (store.getState().screen !== "canvas") return;
      const action = matchShortcut(e, isMac);
      if (!action) return;
      e.preventDefault();
      runShortcut(action, store, window.innerWidth - 520);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
}
```

2. Create `src/ui/app/Toast.tsx` with exactly this content:

```tsx
import { useEffect } from "react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./app.css";

export const TOAST_MS = 5000;

export function Toast() {
  const actions = useActions();
  const toast = useStudio((s) => s.toast);
  const id = toast?.id ?? null;
  useEffect(() => {
    if (id === null) return;
    const timer = setTimeout(() => actions.dismissToast(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, actions]);
  if (!toast) return null;
  return (
    <div className={`m-toast m-toast--${toast.tone}`} role="status" data-testid={TEST_IDS.toast}>
      <span className="m-dot" />
      <span>{toast.text}</span>
      {toast.undo && <Button size="sm" variant="secondary" onClick={() => { actions.dismissToast(); void actions.undo(); }}>Undo</Button>}
    </div>
  );
}
```

3. Create `src/ui/app/ToolDock.tsx` with exactly this content:

```tsx
import { Circle, CodeXml, Frame, Hand, Image, MessageSquare, MousePointer2, Square, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { ToolId } from "../../contracts/ui.tsx";
import { IconButton } from "../components/Button.tsx";
import "./app.css";

export const TOOLS: readonly { id: ToolId; label: string; icon: LucideIcon }[] = [
  { id: "move", label: "Move (V)", icon: MousePointer2 },
  { id: "frame", label: "Frame (F)", icon: Frame },
  { id: "rect", label: "Rectangle (R)", icon: Square },
  { id: "ellipse", label: "Ellipse (O)", icon: Circle },
  { id: "text", label: "Text (T)", icon: Type },
  { id: "image", label: "Image (Shift+Mod+K)", icon: Image },
  { id: "hand", label: "Hand (H)", icon: Hand },
];

export function ToolDock() {
  const actions = useActions();
  const tool = useStudio((s) => s.tool);
  const project = useStudio((s) => s.project);
  const page = useStudio((s) => s.page);
  const file = project?.pages.find((p) => p.name === page)?.file ?? null;
  return (
    <div className="m-dock" role="toolbar" aria-label="Tools" data-testid={TEST_IDS.toolDock}>
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <IconButton key={id} label={label} active={tool === id} onClick={() => actions.setTool(id)}><Icon /></IconButton>
      ))}
      <span className="m-dock__sep" />
      <IconButton label="Ask agent (Mod+I)" onClick={() => actions.openAgentPrompt()}><MessageSquare /></IconButton>
      <IconButton label="Code (Mod+E)" disabled={!file} onClick={() => { if (file) void actions.openCode(file, null); }}><CodeXml /></IconButton>
    </div>
  );
}
```

4. Create `tests/ui/dock-shortcuts.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ToolDock } from "../../src/ui/app/ToolDock.tsx";
import { Toast, TOAST_MS } from "../../src/ui/app/Toast.tsx";
import { comboOf, isTyping, matchShortcut, runShortcut } from "../../src/ui/app/shortcuts.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
const key = (k: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; code: string }> = {}) =>
  ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("shortcuts", () => {
  it("builds key combos with shift and mod", () => {
    expect(comboOf(key("Z", { shiftKey: true, ctrlKey: true }), false)).toBe("shift+mod+z");
    expect(comboOf(key("!", { shiftKey: true, code: "Digit1" }), false)).toBe("shift+1");
    expect(comboOf(key("i", { metaKey: true }), true)).toBe("mod+i");
    expect(comboOf(key("i", { metaKey: true }), false)).toBe("i");
  });
  it("matches the contract shortcuts", () => {
    expect(matchShortcut(key("v"), false)).toBe("tool:move");
    expect(matchShortcut(key("A", { shiftKey: true }), false)).toBe("wrap");
    expect(matchShortcut(key("z", { ctrlKey: true }), false)).toBe("undo");
    expect(matchShortcut(key("Backspace"), false)).toBe("delete");
    expect(matchShortcut(key("v", { altKey: true }), false)).toBeNull();
    expect(matchShortcut(key("q"), false)).toBeNull();
  });
  it("runs shortcut actions against the store", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", selection: "1", zoom: 0.5 });
    for (const a of ["tool:rect", "delete", "deselect", "zoom:in", "code", "undo"] as const) runShortcut(a, store, 900);
    expect(store.calls.map((c) => c.name)).toEqual(["setTool", "removeSelected", "select", "setZoom", "openCode", "undo"]);
    expect(store.calls[0].args).toEqual(["rect"]);
    expect(store.calls[4].args).toEqual(["index.html", null]);
  });
  it("does not delete or wrap without a selection", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    runShortcut("delete", store, 900);
    runShortcut("wrap", store, 900);
    expect(store.calls).toEqual([]);
  });
  it("recognises typing targets", () => {
    expect(isTyping(document.createElement("input"))).toBe(true);
    expect(isTyping(document.createElement("div"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("ToolDock and Toast", () => {
  it("sets tools and opens the agent prompt", async () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", tool: "move" });
    render(<StudioContext.Provider value={store}><ToolDock /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Text (T)" }));
    await userEvent.click(screen.getByRole("button", { name: "Ask agent (Mod+I)" }));
    await userEvent.click(screen.getByRole("button", { name: "Code (Mod+E)" }));
    expect(store.calls).toEqual([{ name: "setTool", args: ["text"] }, { name: "openAgentPrompt", args: [] }, { name: "openCode", args: ["index.html", null] }]);
  });
  it("shows a toast with undo and dismisses it after a delay", () => {
    vi.useFakeTimers();
    const store = createFakeStore({ toast: { id: 1, tone: "success", text: "Saved to styles.css", undo: true } });
    render(<StudioContext.Provider value={store}><Toast /></StudioContext.Provider>);
    expect(screen.getByTestId("toast")).toHaveTextContent("Saved to styles.cssUndo");
    act(() => { screen.getByRole("button", { name: "Undo" }).click(); });
    act(() => { vi.advanceTimersByTime(TOAST_MS); });
    expect(store.calls.map((c) => c.name)).toEqual(["dismissToast", "undo", "dismissToast"]);
    vi.useRealTimers();
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL build key combos as shift, mod, key and match them against SHORTCUTS. (test: "matches the contract shortcuts")
- IF there is no selection THEN THE SYSTEM SHALL ignore delete and wrap. (test: "does not delete or wrap without a selection")
- WHEN a toast is shown THE SYSTEM SHALL offer Undo for undoable toasts and dismiss it after 5 seconds. (test: "shows a toast with undo and dismisses it after a delay")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T031`.
The last line must be `GATE PASS T031`. On `GATE FAIL T031 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T031` prints `GATE PASS T031`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T031: Build the tool dock, toast and keyboard shortcuts
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
