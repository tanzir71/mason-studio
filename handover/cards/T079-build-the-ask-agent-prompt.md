# T079: Build the ask-agent prompt

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T079 (build), phase 9 |
| Depends on | T078 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R32 |

**Create:** `src/ui/agent/AgentPrompt.tsx`, `tests/ui/agent-prompt.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T079`):

1. `npx vitest run tests/ui/agent-prompt.test.tsx` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The prompt box asks the configured model about the selected layer; Mod+Enter sends, Escape closes.

## Context

UI module, agent area. Styles `.m-ask*` are in `agent.css` (T078). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

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

## Current state

`src/ui/agent/agent.css` and `ReviewCard.tsx` exist.

## Steps

1. Create `src/ui/agent/AgentPrompt.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { Button } from "../components/Button.tsx";
import "./agent.css";

/** "Ask agent" box for the selected layer. Mod+Enter sends; Escape closes. */
export function AgentPrompt() {
  const actions = useActions();
  const open = useStudio((s) => s.agentPrompt.open);
  const busy = useStudio((s) => s.agentPrompt.busy);
  const name = useStudio((s) => s.inspect?.name ?? null);
  const model = useStudio((s) => s.settings?.agent.model ?? null);
  const [text, setText] = useState("");
  if (!open) return null;
  const send = () => { if (text.trim() !== "" && !busy) void actions.askAgent(text.trim()); };
  return (
    <section className="m-ask" data-testid={TEST_IDS.agentPrompt} aria-label="Ask agent">
      <span className="m-ask__label">{`Ask ${model ?? "the agent"} about ${name ?? "this layer"}. Changes come back as a proposal.`}</span>
      <textarea className="m-ask__input" aria-label="Request" autoFocus value={text} disabled={busy}
        placeholder="Make the headline tighter on tablets"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          if (e.key === "Escape") { e.preventDefault(); actions.closeAgentPrompt(); }
        }} />
      <div className="m-ask__row">
        <Button variant="ghost" size="sm" onClick={() => actions.closeAgentPrompt()}>Cancel</Button>
        <Button variant="primary" size="sm" disabled={busy || text.trim() === ""} onClick={send}>{busy ? "Asking…" : "Ask"}</Button>
      </div>
    </section>
  );
}
```

2. Create `tests/ui/agent-prompt.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AgentPrompt } from "../../src/ui/agent/AgentPrompt.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { InspectResult } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const state = { agentPrompt: { open: true, busy: false }, inspect: { name: "Headline" } as InspectResult, settings: DEFAULT_SETTINGS };

describe("AgentPrompt", () => {
  it("names the model and the layer and sends with Mod+Enter", async () => {
    const store = createFakeStore(state);
    render(<StudioContext.Provider value={store}><AgentPrompt /></StudioContext.Provider>);
    expect(screen.getByTestId("agent-prompt")).toHaveTextContent("Ask qwen2.5-coder:7b about Headline.");
    await userEvent.type(screen.getByLabelText("Request"), "Tighter on tablets{Control>}{Enter}{/Control}");
    expect(store.calls).toEqual([{ name: "askAgent", args: ["Tighter on tablets"] }]);
  });
  it("closes on Escape and disables Ask while empty or busy", async () => {
    const store = createFakeStore(state);
    render(<StudioContext.Provider value={store}><AgentPrompt /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Request"), "{Escape}");
    expect(store.calls).toEqual([{ name: "closeAgentPrompt", args: [] }]);
  });
  it("renders nothing while closed", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><AgentPrompt /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL name the model and layer and send with Mod+Enter. (test: "names the model and the layer and sends with Mod+Enter")
- WHEN Escape is pressed THE SYSTEM SHALL close the prompt. (test: "closes on Escape and disables Ask while empty or busy")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T079`.
The last line must be `GATE PASS T079`. On `GATE FAIL T079 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T079` prints `GATE PASS T079`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T079: Build the ask-agent prompt
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
