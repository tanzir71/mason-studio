# T023: Build the field, section and tab primitives

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T023 (build), phase 3 |
| Depends on | T022 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R16 |

**Create:** `src/ui/components/Field.tsx`, `src/ui/components/Tabs.tsx`, `src/ui/components/Inputs.stories.tsx`, `tests/ui/inputs.test.tsx`

**Modify:** none

**Read only:** `src/ui/components/Button.tsx`, `src/ui/components/primitives.css`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T023`):

1. `npx vitest run tests/ui/inputs.test.tsx` -> exit 0, output contains `Tests  7 passed (7)`
2. `npx storybook build --quiet -o storybook-static` -> exit 0, output contains `build completed successfully`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`Field`, `Section` and `Tabs` exist with stories, and Storybook builds.

## Context

UI module, components area. The Design panel (phase 4) is made of these. Styles already exist in `primitives.css` (T022). UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

This card uses no contract types.

## Current state

`src/ui/components/Button.tsx` exports `cx`, `Button`, `IconButton`, `Chip`; `src/ui/components/primitives.css` has the `.m-field*`, `.m-tabs*` and `.m-section*` rules.

## Steps

1. Create `src/ui/components/Field.tsx` with exactly this content:

```tsx
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "./Button.tsx";
import "./primitives.css";

export interface FieldProps {
  /** Accessible name of the input (aria-label). */
  label: string;
  value: string;
  onCommit(value: string): void;
  /** Short visible label inside the field, e.g. "W" or "Size". */
  prefix?: string;
  /** Small mono text after the input, e.g. a token value. */
  suffix?: string;
  /** Tablet/mobile override: tinted border. */
  override?: boolean;
  mono?: boolean;
  placeholder?: string;
  testId?: string;
}
/**
 * Text field that commits on Enter or blur (only when the trimmed draft is not empty, differs from `value` and was
 * not just committed) and reverts on Escape.
 */
export function Field({ label, value, onCommit, prefix, suffix, override = false, mono = false, placeholder, testId }: FieldProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef<string | null>(null);
  useEffect(() => { setDraft(value); committed.current = null; }, [value]);
  const commit = () => {
    const next = draft.trim();
    if (next === "" || next === value) { setDraft(value); return; }
    if (next === committed.current) return;
    committed.current = next;
    onCommit(next);
  };
  return (
    <label className={cx("m-field", override && "is-override", mono && "is-mono")} data-testid={testId}>
      {prefix && <span className="m-field__prefix">{prefix}</span>}
      <input
        className="m-field__input" aria-label={label} value={draft} placeholder={placeholder} spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); }
        }}
      />
      {suffix && <span className="m-field__suffix">{suffix}</span>}
    </label>
  );
}

export interface SectionProps { title: string; action?: ReactNode; children?: ReactNode; testId?: string }
export function Section({ title, action, children, testId }: SectionProps) {
  return (
    <section className="m-section" data-testid={testId}>
      <header className="m-section__head">
        <h3 className="m-section__title">{title}</h3>
        {action}
      </header>
      {children && <div className="m-section__body">{children}</div>}
    </section>
  );
}
```

2. Create `src/ui/components/Tabs.tsx` with exactly this content:

```tsx
import { cx } from "./Button.tsx";
import "./primitives.css";

export interface TabItem<T extends string> { id: T; label: string; dot?: string }
export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange(id: T): void;
  /** "tabs" for panel headers, "segmented" for the filled switch (Applies to). */
  variant?: "tabs" | "segmented";
  label: string;
  testId?: string;
}
export function Tabs<T extends string>({ items, value, onChange, variant = "tabs", label, testId }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cx("m-tabs", variant === "segmented" && "m-tabs--segmented")} data-testid={testId}>
      {items.map((item) => (
        <button
          key={item.id} type="button" role="tab" aria-selected={item.id === value} className="m-tabs__tab"
          onClick={() => { if (item.id !== value) onChange(item.id); }}
        >
          {item.dot && <span className="m-dot" style={{ background: item.dot }} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

3. Create `src/ui/components/Inputs.stories.tsx` with exactly this content:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field, Section } from "./Field.tsx";
import { Tabs } from "./Tabs.tsx";

const meta: Meta<typeof Field> = { title: "Primitives/Inputs", component: Field };
export default meta;
type Story = StoryObj<typeof Field>;

export const Plain: Story = { args: { label: "Width", prefix: "W", value: "Fill", onCommit: () => {} } };
export const Override: Story = { args: { label: "Font size", prefix: "Size", value: "32", override: true, onCommit: () => {} } };
export const TokenValue: Story = { args: { label: "Gap", prefix: "Gap", value: "space.5", suffix: "24", mono: true, onCommit: () => {} } };
export const PanelTabs: Story = {
  render: () => {
    const [tab, setTab] = useState<"design" | "inspect" | "checks">("design");
    return <Tabs<"design" | "inspect" | "checks"> label="Panel" value={tab} onChange={setTab} items={[{ id: "design", label: "Design" }, { id: "inspect", label: "Inspect" }, { id: "checks", label: "Checks" }]} />;
  },
};
export const Scope: Story = {
  render: () => {
    const [scope, setScope] = useState<"all" | "tablet" | "mobile">("tablet");
    return (
      <div style={{ width: 248 }}>
        <Tabs<"all" | "tablet" | "mobile"> variant="segmented" label="Applies to" value={scope} onChange={setScope}
          items={[{ id: "all", label: "All sizes" }, { id: "tablet", label: "≤ 768", dot: "var(--bp-tablet)" }, { id: "mobile", label: "≤ 375", dot: "var(--bp-mobile)" }]} />
      </div>
    );
  },
};
export const PanelSection: Story = {
  render: () => (
    <div style={{ width: 280, background: "var(--bg-panel)" }}>
      <Section title="Layout">
        <Field label="Width" prefix="W" value="Fill" onCommit={() => {}} />
      </Section>
    </div>
  ),
};
```

4. Create `tests/ui/inputs.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Field, Section } from "../../src/ui/components/Field.tsx";
import { Tabs } from "../../src/ui/components/Tabs.tsx";

describe("Field", () => {
  it("commits a changed value on Enter", async () => {
    const onCommit = vi.fn();
    render(<Field label="Font size" prefix="Size" value="32" onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    await userEvent.clear(input);
    await userEvent.type(input, " 36 {Enter}");
    expect(onCommit).toHaveBeenCalledWith("36");
  });
  it("does not commit an unchanged or empty value and reverts on Escape", async () => {
    const onCommit = vi.fn();
    render(<Field label="Width" value="Fill" onCommit={onCommit} />);
    const input = screen.getByLabelText("Width");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue("Fill");
    await userEvent.type(input, "x{Escape}");
    expect(input).toHaveValue("Fill");
    expect(onCommit).not.toHaveBeenCalled();
  });
  it("shows prefix, suffix and the override border", () => {
    render(<Field label="Gap" prefix="Gap" suffix="24" value="space.5" override mono testId="gap" onCommit={() => {}} />);
    const field = screen.getByTestId("gap");
    expect(field).toHaveClass("m-field", "is-override", "is-mono");
    expect(field).toHaveTextContent("Gap24");
  });
  it("follows a new value from props", () => {
    const { rerender } = render(<Field label="Size" value="32" onCommit={() => {}} />);
    rerender(<Field label="Size" value="28" onCommit={() => {}} />);
    expect(screen.getByLabelText("Size")).toHaveValue("28");
  });
});

describe("Tabs and Section", () => {
  it("marks the selected tab and reports changes", async () => {
    const onChange = vi.fn();
    render(<Tabs label="Panel" value="design" onChange={onChange} items={[{ id: "design", label: "Design" }, { id: "checks", label: "Checks" }]} />);
    expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Design" }));
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("checks");
  });
  it("renders the segmented variant with dots", () => {
    render(<Tabs variant="segmented" label="Applies to" value="all" onChange={() => {}} items={[{ id: "all", label: "All sizes" }, { id: "tablet", label: "≤ 768", dot: "teal" }]} />);
    expect(screen.getByRole("tablist", { name: "Applies to" })).toHaveClass("m-tabs--segmented");
    expect(screen.getByRole("tab", { name: "≤ 768" }).querySelector(".m-dot")).not.toBeNull();
  });
  it("renders a section with title, action and body", () => {
    render(<Section title="Layout" action={<button type="button">Add</button>} testId="layout"><p>body</p></Section>);
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByTestId("layout")).toHaveTextContent("LayoutAddbody");
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- WHEN Enter is pressed with a changed value THE SYSTEM SHALL commit the trimmed value. (test: "commits a changed value on Enter")
- WHEN Escape is pressed or the value is unchanged or empty THE SYSTEM SHALL not commit. (test: "does not commit an unchanged or empty value and reverts on Escape")
- THE SYSTEM SHALL mark the selected tab with aria-selected and report only changes. (test: "marks the selected tab and reports changes")
- WHEN Storybook builds THE SYSTEM SHALL print "build completed successfully" (verify: storybook build).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T023`.
The last line must be `GATE PASS T023`. On `GATE FAIL T023 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T023` prints `GATE PASS T023`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T023: Build the field, section and tab primitives
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
