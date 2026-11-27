# T084: Add the Git chip to the top bar

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T084 (build), phase 10 |
| Depends on | T083, T028 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R34 |

**Create:** `src/ui/app/GitChip.tsx`, `tests/ui/git-chip.test.tsx`

**Modify:** `src/ui/app/app.css`, `src/ui/app/TopBar.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T084`):

1. `npx vitest run tests/ui/git-chip.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx vitest run tests/ui/top-bar.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The top bar shows "N changes" with a Commit button that opens a message box; folders without Git show "No Git".

## Context

UI module, app area. The chip only reads `git` from the store; the store keeps it fresh. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface GitStatus { isRepo: boolean; branch: string | null; changes: number; files: string[] }
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

`src/ui/app/TopBar.tsx` (T028) contains the line `        {/* git chip: added by the Git card */}` in its right-hand group.

## Steps

1. Create `src/ui/app/GitChip.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { GitBranch } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./app.css";

/** "N changes · Commit" chip with a small commit box. The store refreshes `git` whenever the page reloads. */
export function GitChip() {
  const actions = useActions();
  const git = useStudio((s) => s.git);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  if (!git || !git.isRepo) {
    return <span className="m-status m-git is-off" data-testid={TEST_IDS.gitChip}><GitBranch size={14} />No Git</span>;
  }
  const submit = () => { if (message.trim()) { void actions.commit(message.trim()); setMessage(""); setOpen(false); } };
  return (
    <div className="m-anchor m-git" data-testid={TEST_IDS.gitChip}>
      <span className="m-status"><GitBranch size={14} />{git.changes === 1 ? "1 change" : `${git.changes} changes`}</span>
      <Button size="sm" variant="secondary" disabled={git.changes === 0} onClick={() => setOpen(!open)}>Commit</Button>
      {open && (
        <div className="m-menu m-commit" role="dialog" aria-label="Commit">
          <input className="m-input" aria-label="Commit message" autoFocus placeholder={`Commit to ${git.branch ?? "this branch"}`} value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
          <Button size="sm" variant="primary" disabled={message.trim() === ""} onClick={submit}>Commit</Button>
        </div>
      )}
    </div>
  );
}
```

2. Append these lines to the end of `src/ui/app/app.css`:

```css
.m-git { display: inline-flex; align-items: center; gap: 4px; }
.m-git.is-off { color: var(--text-faint); }
.m-commit { right: 0; top: 34px; display: grid; gap: var(--space-2); width: 260px; padding: var(--space-2); }
.m-commit .m-input { height: 32px; padding: 0 var(--space-2); border: 1px solid var(--border-default); border-radius: var(--radius-6); background: var(--bg-inset); color: var(--text-strong); }
```

3. In `src/ui/app/TopBar.tsx` add `import { GitChip } from "./GitChip.tsx";` below the `Button.tsx` import and replace the line `        {/* git chip: added by the Git card */}` with `        <GitChip />`.

4. Create `tests/ui/git-chip.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { GitChip } from "../../src/ui/app/GitChip.tsx";
import { TopBar } from "../../src/ui/app/TopBar.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const git = { isRepo: true, branch: "main", changes: 3, files: ["a", "b", "c"] };

describe("GitChip", () => {
  it("shows the number of changes and commits with a message", async () => {
    const store = createFakeStore({ git });
    render(<StudioContext.Provider value={store}><GitChip /></StudioContext.Provider>);
    expect(screen.getByTestId("git-chip")).toHaveTextContent("3 changes");
    await userEvent.click(screen.getByRole("button", { name: "Commit" }));
    await userEvent.type(screen.getByLabelText("Commit message"), "Tighter headline{Enter}");
    expect(store.calls).toEqual([{ name: "commit", args: ["Tighter headline"] }]);
    expect(screen.queryByLabelText("Commit message")).toBeNull();
  });
  it("disables Commit without changes and says when there is no Git", () => {
    const { unmount } = render(<StudioContext.Provider value={createFakeStore({ git: { ...git, changes: 0, files: [] } })}><GitChip /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    unmount();
    render(<StudioContext.Provider value={createFakeStore({ git: null })}><GitChip /></StudioContext.Provider>);
    expect(screen.getByTestId("git-chip")).toHaveTextContent("No Git");
  });
  it("sits in the top bar", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", git })}><TopBar /></StudioContext.Provider>);
    expect(screen.getByTestId("top-bar")).toContainElement(screen.getByTestId("git-chip"));
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show the number of changes and commit with the typed message on Enter. (test: "shows the number of changes and commits with a message")
- WHILE there are no changes THE SYSTEM SHALL disable Commit; without Git it SHALL show "No Git". (test: "disables Commit without changes and says when there is no Git")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T084`.
The last line must be `GATE PASS T084`. On `GATE FAIL T084 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T084` prints `GATE PASS T084`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T084: Add the Git chip to the top bar
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
