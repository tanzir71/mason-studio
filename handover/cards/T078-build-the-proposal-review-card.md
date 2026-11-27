# T078: Build the proposal review card

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T078 (build), phase 9 |
| Depends on | T077, T022 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R31 |

**Create:** `src/ui/agent/agent.css`, `src/ui/agent/ReviewCard.tsx`, `tests/ui/review-card.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T078`):

1. `npx vitest run tests/ui/review-card.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The review card shows the newest pending proposal: source, summary, numbered changes with before → after and scope, blocked reasons, and Accept / Reject / Accept all.

## Context

UI module, agent area. `agent.css` holds the styles of the review card, the agent prompt and the settings dialog. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface Proposal { id: string; source: string; page: string; summary: string; createdAt: number; status: ProposalStatus; changes: ProposalChange[] }
export interface ProposalChange extends ProposedChange { label: string; from: string | null; blocked: CheckFinding | null }
/** "Applies to" scope. "all" edits base rules; "tablet"/"mobile" edit `@media (max-width: Npx)` rules. */
export type Scope = "all" | "tablet" | "mobile";
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

`src/ui/agent/` does not exist.

## Steps

1. Create `src/ui/agent/agent.css` with exactly this content:

```css
.m-review {
  position: absolute; right: 12px; bottom: 64px; z-index: 12; width: 320px; border: 1px solid var(--border-default);
  border-radius: var(--radius-12); background: var(--bg-panel); box-shadow: var(--shadow-float);
}
.m-review__head { display: grid; gap: 2px; padding: var(--space-3); border-bottom: 1px solid var(--border-subtle); }
.m-review__title { display: flex; align-items: center; gap: var(--space-2); margin: 0; font: var(--title-13); color: var(--text-strong); }
.m-review__title .m-dot { background: var(--success); }
.m-review__meta { font: var(--text-12); color: var(--text-muted); }
.m-review__list { margin: 0; padding: var(--space-1) 0; list-style: none; }
.m-change { display: grid; grid-template-columns: 20px 1fr; gap: 2px var(--space-2); padding: var(--space-2) var(--space-3); }
.m-change__num { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: var(--accent-on); font: 600 10px/1 var(--font-sans); }
.m-change.is-blocked .m-change__num { background: var(--danger); }
.m-change__label { font: var(--label-12); color: var(--text-strong); }
.m-change__value { grid-column: 2; font: var(--code-11); color: var(--text-muted); }
.m-change__blocked { grid-column: 2; font: var(--code-11); color: var(--danger); }
.m-review__actions { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); border-top: 1px solid var(--border-subtle); }
.m-review__spacer { flex: 1; }
.m-review__more { font: var(--text-11); color: var(--text-faint); }

.m-ask {
  position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%); z-index: 12; width: 440px; display: grid; gap: var(--space-2);
  padding: var(--space-3); border: 1px solid var(--border-default); border-radius: var(--radius-12); background: var(--bg-panel); box-shadow: var(--shadow-float);
}
.m-ask__label { font: var(--text-12); color: var(--text-muted); }
.m-ask__input { min-height: 64px; resize: vertical; padding: var(--space-2); border: 1px solid var(--border-default); border-radius: var(--radius-8); background: var(--bg-inset); color: var(--text-strong); font: var(--text-13); }
.m-ask__input:focus { outline: none; border-color: var(--accent); }
.m-ask__row { display: flex; justify-content: flex-end; gap: var(--space-2); }

.m-dialog-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(0, 0, 0, 0.45); }
.m-dialog { width: 440px; max-width: calc(100vw - 32px); border: 1px solid var(--border-default); border-radius: var(--radius-12); background: var(--bg-panel); box-shadow: var(--shadow-float); }
.m-dialog__head { padding: var(--space-4); border-bottom: 1px solid var(--border-subtle); }
.m-dialog__title { margin: 0; font: var(--heading-16); color: var(--text-strong); }
.m-dialog__body { display: grid; gap: var(--space-3); padding: var(--space-4); }
.m-dialog__row { display: grid; gap: 4px; font: var(--text-12); color: var(--text-muted); }
.m-dialog__hint { font: var(--text-11); color: var(--text-faint); }
.m-dialog__check { display: flex; align-items: center; gap: var(--space-2); font: var(--text-13); color: var(--text-strong); }
.m-dialog__foot { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border-subtle); }
.m-input { height: 32px; padding: 0 var(--space-2); border: 1px solid var(--border-default); border-radius: var(--radius-6); background: var(--bg-inset); color: var(--text-strong); font: var(--text-13); }
.m-input:focus { outline: none; border-color: var(--accent); }
```

2. Create `src/ui/agent/ReviewCard.tsx` with exactly this content:

```tsx
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import type { Proposal, Scope } from "../../contracts/model.ts";
import { Button, cx } from "../components/Button.tsx";
import "./agent.css";

const SCOPE_TEXT: Record<Scope, string> = { all: "all sizes", tablet: "≤ 768", mobile: "≤ 375" };

/** "32px → 30px · ≤ 768"; "new → 30px" when nothing was set. */
export function changeLine(from: string | null, value: string, scope: Scope): string {
  return `${from ?? "new"} → ${value} · ${SCOPE_TEXT[scope]}`;
}

/** Review card for the newest pending proposal. Nothing is written until Accept. */
export function ReviewCard() {
  const actions = useActions();
  const proposals = useStudio((s) => s.proposals);
  const busy = useStudio((s) => s.busy);
  const pending = proposals.filter((p) => p.status === "pending");
  const proposal: Proposal | undefined = pending[0];
  if (!proposal) return null;
  const allowed = proposal.changes.filter((c) => c.blocked === null).length;
  const blocked = proposal.changes.length - allowed;
  return (
    <section className="m-review" data-testid={TEST_IDS.reviewCard} aria-label="Proposed changes">
      <header className="m-review__head">
        <h2 className="m-review__title"><span className="m-dot" />{`${proposal.source} proposes ${proposal.changes.length} ${proposal.changes.length === 1 ? "change" : "changes"}`}</h2>
        <span className="m-review__meta">{proposal.summary}</span>
        <span className="m-review__meta">{`${proposal.page} · nothing is saved until you accept`}</span>
      </header>
      <ol className="m-review__list">
        {proposal.changes.map((c, i) => (
          <li key={i} className={cx("m-change", c.blocked !== null && "is-blocked")}>
            <span className="m-change__num">{i + 1}</span>
            <span className="m-change__label">{c.label}</span>
            <span className="m-change__value">{changeLine(c.from, c.value, c.scope)}</span>
            {c.blocked && <span className="m-change__blocked">{`Blocked: ${c.blocked.title}`}</span>}
          </li>
        ))}
      </ol>
      <footer className="m-review__actions">
        <Button variant="primary" size="sm" disabled={busy || allowed === 0} onClick={() => { void actions.acceptProposal(proposal.id, false); }}>
          {`Accept ${allowed}`}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void actions.rejectProposal(proposal.id); }}>Reject</Button>
        <span className="m-review__spacer" />
        {blocked > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void actions.acceptProposal(proposal.id, true); }}>Accept all</Button>}
        {pending.length > 1 && <span className="m-review__more">{`+${pending.length - 1} more`}</span>}
      </footer>
    </section>
  );
}
```

3. Create `tests/ui/review-card.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ReviewCard, changeLine } from "../../src/ui/agent/ReviewCard.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { CheckFinding, Proposal } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const ban = { id: "taste:12", title: "No stock AI purple" } as CheckFinding;
const proposal: Proposal = { id: "p1", source: "Claude Code", page: "Home", summary: "Tighter tablet headline", createdAt: 1, status: "pending", changes: [
  { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet", label: "Headline size", from: "32px", blocked: null },
  { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all", label: "Hero fill", from: null, blocked: ban },
] };

describe("ReviewCard", () => {
  it("formats a change line", () => {
    expect(changeLine("32px", "30px", "tablet")).toBe("32px → 30px · ≤ 768");
    expect(changeLine(null, "0", "all")).toBe("new → 0 · all sizes");
  });
  it("shows the newest pending proposal with blocked changes", () => {
    render(<StudioContext.Provider value={createFakeStore({ proposals: [proposal] })}><ReviewCard /></StudioContext.Provider>);
    const card = screen.getByTestId("review-card");
    expect(card).toHaveTextContent("Claude Code proposes 2 changes");
    expect(card).toHaveTextContent("Tighter tablet headline");
    const items = within(card).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Headline size32px → 30px · ≤ 768");
    expect(items[1]).toHaveClass("is-blocked");
    expect(items[1]).toHaveTextContent("Blocked: No stock AI purple");
    expect(screen.getByRole("button", { name: "Accept 1" })).toBeEnabled();
  });
  it("accepts allowed changes, accepts all, or rejects", async () => {
    const store = createFakeStore({ proposals: [proposal] });
    render(<StudioContext.Provider value={store}><ReviewCard /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Accept 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(store.calls).toEqual([{ name: "acceptProposal", args: ["p1", false] }, { name: "acceptProposal", args: ["p1", true] }, { name: "rejectProposal", args: ["p1"] }]);
  });
  it("hides when nothing is pending", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore({ proposals: [{ ...proposal, status: "accepted" }] })}><ReviewCard /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL show each change as "<from> → <value> · <scope>" with blocked reasons. (test: "shows the newest pending proposal with blocked changes")
- WHEN Accept, Accept all or Reject is clicked THE SYSTEM SHALL call acceptProposal(id, false), acceptProposal(id, true) or rejectProposal(id). (test: "accepts allowed changes, accepts all, or rejects")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T078`.
The last line must be `GATE PASS T078`. On `GATE FAIL T078 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T078` prints `GATE PASS T078`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T078: Build the proposal review card
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
