# T022: Build the button primitives and their styles

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T022 (build), phase 3 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R16 |

**Create:** `src/ui/components/primitives.css`, `src/ui/components/Button.tsx`, `src/ui/components/Button.stories.tsx`, `tests/ui/button.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T022`):

1. `npx vitest run tests/ui/button.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`Button`, `IconButton`, `Chip` and `cx` exist with the Mason styles and Storybook stories.

## Context

UI module, components area. `primitives.css` holds the styles of every primitive (buttons, chips, fields, tabs, sections) so later components only import it. Values follow Figma "Mason" → 01 Foundations through the tokens. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

This card uses no contract types; it only reads the CSS variables of `src/contracts/tokens.css` (already loaded by `src/ui/styles/global.css`).

## Current state

`src/ui/components/` does not exist. lucide-react 1.81.0 and Storybook 10.6.9 are installed; `.storybook/main.ts` loads `src/ui/**/*.stories.tsx`.

## Steps

1. Create `src/ui/components/primitives.css` with exactly this content:

```css
/* Mason UI primitives. Every value comes from src/contracts/tokens.css. */
.m-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1);
  height: 28px; padding: 0 var(--space-3); border-radius: var(--radius-6);
  border: 1px solid transparent; font: var(--label-12); white-space: nowrap;
}
.m-btn--sm { height: 24px; padding: 0 var(--space-2); }
.m-btn--primary { background: var(--accent); color: var(--accent-on); }
.m-btn--primary:hover { background: var(--accent-strong); }
.m-btn--secondary { background: var(--bg-raised); color: var(--text-strong); border-color: var(--border-default); }
.m-btn--secondary:hover { background: var(--bg-hover); }
.m-btn--ghost { background: transparent; color: var(--text-default); }
.m-btn--ghost:hover { background: var(--bg-hover); color: var(--text-strong); }
.m-btn--danger { background: var(--danger-subtle); color: var(--danger); }
.m-btn:disabled { opacity: 0.5; cursor: default; }

.m-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--radius-6);
  background: transparent; color: var(--text-muted);
}
.m-icon-btn:hover { background: var(--bg-hover); color: var(--text-strong); }
.m-icon-btn.is-active { background: var(--accent); color: var(--accent-on); }
.m-icon-btn svg { width: 16px; height: 16px; }

.m-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 var(--space-2);
  border: 0; border-radius: var(--radius-6); background: transparent; color: var(--text-muted); font: var(--label-12);
}
.m-chip:hover { color: var(--text-strong); }
.m-chip.is-active { background: var(--bg-hover); color: var(--text-strong); }
.m-chip__meta { font: var(--code-11); color: var(--text-faint); }
.m-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex: none; }

.m-field {
  display: flex; align-items: center; gap: 6px; height: 28px; min-width: 0; padding: 0 var(--space-2);
  border: 1px solid transparent; border-radius: var(--radius-6); background: var(--bg-raised);
}
.m-field:hover { border-color: var(--border-default); }
.m-field:focus-within { border-color: var(--accent); }
.m-field.is-override { border-color: var(--bp-tablet); }
.m-field__prefix { font: var(--text-11); color: var(--text-faint); flex: none; }
.m-field__input {
  flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; outline: 0; background: transparent;
  color: var(--text-strong); font: var(--text-12);
}
.m-field.is-mono .m-field__input { font: var(--code-12); }
.m-field__suffix { font: var(--code-11); color: var(--text-faint); flex: none; }

.m-tabs { display: flex; align-items: center; gap: 2px; }
.m-tabs__tab {
  height: 26px; padding: 0 var(--space-2); border: 0; border-radius: var(--radius-6);
  background: transparent; color: var(--text-muted); font: var(--label-12);
}
.m-tabs__tab:hover { color: var(--text-strong); }
.m-tabs__tab[aria-selected="true"] { background: var(--bg-hover); color: var(--text-strong); }
.m-tabs--segmented { padding: 2px; border-radius: var(--radius-8); background: var(--bg-inset); }
.m-tabs--segmented .m-tabs__tab { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.m-tabs--segmented .m-tabs__tab[aria-selected="true"] { background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--border-default); }

.m-section { border-bottom: 1px solid var(--border-subtle); padding: var(--space-3) var(--space-3) var(--space-4); }
.m-section__head { display: flex; align-items: center; justify-content: space-between; height: 24px; margin-bottom: var(--space-2); }
.m-section__title { margin: 0; font: var(--title-13); color: var(--text-strong); }
.m-section__body { display: grid; gap: var(--space-2); }
```

2. Create `src/ui/components/Button.tsx` with exactly this content:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./primitives.css";

/** Joins the truthy class names with spaces. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}
export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cx("m-btn", `m-btn--${variant}`, size === "sm" && "m-btn--sm", className)} {...rest} />;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}
/** Square icon button. `label` becomes aria-label and title; `active` sets aria-pressed and the accent fill. */
export function IconButton({ label, active = false, className, type = "button", ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} aria-pressed={active} className={cx("m-icon-btn", active && "is-active", className)} {...rest} />;
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** CSS color of the leading dot; no dot when omitted. */
  dot?: string;
  /** Small mono text after the label, e.g. "1280" or "≤ 768". */
  meta?: string;
  children: ReactNode;
}
export function Chip({ active = false, dot, meta, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cx("m-chip", active && "is-active", className)} {...rest}>
      {dot && <span className="m-dot" style={{ background: dot }} />}
      {children}
      {meta && <span className="m-chip__meta">{meta}</span>}
    </button>
  );
}
```

3. Create `src/ui/components/Button.stories.tsx` with exactly this content:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hand, MousePointer2, Square } from "lucide-react";
import { Button, Chip, IconButton } from "./Button.tsx";

const meta: Meta<typeof Button> = { title: "Primitives/Button", component: Button };
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary", children: "Commit" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Export" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Reset" } };
export const Danger: Story = { args: { variant: "danger", children: "Reject" } };
export const Tools: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 4 }}>
      <IconButton label="Move" active><MousePointer2 /></IconButton>
      <IconButton label="Rectangle"><Square /></IconButton>
      <IconButton label="Hand"><Hand /></IconButton>
    </div>
  ),
};
export const Chips: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 4 }}>
      <Chip active dot="var(--bp-desktop)" meta="1280">Desktop</Chip>
      <Chip dot="var(--bp-tablet)" meta="≤ 768">Tablet</Chip>
      <Chip dot="var(--bp-mobile)" meta="≤ 375">Mobile</Chip>
    </div>
  ),
};
```

4. Create `tests/ui/button.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Button, Chip, IconButton, cx } from "../../src/ui/components/Button.tsx";

describe("Button primitives", () => {
  it("joins truthy class names", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
  it("renders a typed button with variant classes and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" size="sm" onClick={onClick}>Commit</Button>);
    const button = screen.getByRole("button", { name: "Commit" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("m-btn", "m-btn--primary", "m-btn--sm");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("labels icon buttons and reflects the active state", () => {
    render(<IconButton label="Hand" active><svg /></IconButton>);
    const button = screen.getByRole("button", { name: "Hand" });
    expect(button).toHaveAttribute("title", "Hand");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("m-icon-btn", "is-active");
  });
  it("renders chips with a dot and meta text", () => {
    render(<Chip active dot="red" meta="≤ 768">Tablet</Chip>);
    const chip = screen.getByRole("button", { name: /Tablet/ });
    expect(chip).toHaveClass("m-chip", "is-active");
    expect((chip.querySelector(".m-dot") as HTMLElement).style.background).toBe("red");
    expect(chip).toHaveTextContent("Tablet≤ 768");
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL render buttons with `type="button"` and variant classes. (test: "renders a typed button with variant classes and handles clicks")
- THE SYSTEM SHALL label icon buttons with aria-label and title and expose the active state as aria-pressed. (test: "labels icon buttons and reflects the active state")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T022`.
The last line must be `GATE PASS T022`. On `GATE FAIL T022 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T022` prints `GATE PASS T022`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T022: Build the button primitives and their styles
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
