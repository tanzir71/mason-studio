# T058: Suggest tokens in Design panel fields

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T058 (build), phase 6 |
| Depends on | T057, T055, T044 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R25, R26 |

**Create:** `src/ui/panels/token-options.ts`, `tests/e2e/tokens.spec.ts`, `tests/ui/token-options.test.tsx`

**Modify:** `src/ui/components/Field.tsx`, `src/ui/panels/DesignPanel.tsx`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T058`):

1. `npx vitest run tests/ui/token-options.test.tsx` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/ui/inputs.test.tsx tests/ui/design-panel.test.tsx` -> exit 0, output contains `Tests  10 passed (10)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test tokens.spec.ts --project=chromium` -> exit 0, output contains `2 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Design fields suggest `var(--token)` values of the right type while typing and show the resolved value next to a token value; the phase 6 smoke test imports tokens and applies one.

## Context

UI module, components and panels areas. `Field` gains an optional `options` list rendered as a `<datalist>`. This card also adds the phase 6 Playwright smoke spec; each test undoes its change. UI conventions for this card: components read state only through `useStudio(selector)` with selectors that return a primitive or a value stored in state, and call actions only through `useActions()`; class names start with `m-`; every color, font, radius and spacing comes from the CSS variables in `src/contracts/tokens.css`; user-visible text is exactly as written in the code below.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface TokenSet { tokens: Token[]; file: string | null }
export type InspectProp = (typeof INSPECT_PROPS)[number];
```

## Current state

`src/ui/components/Field.tsx` (T023) and `src/ui/panels/DesignPanel.tsx` (T043) exist; `tokens` is in the store state.

## Steps

1. Create `src/ui/panels/token-options.ts` with exactly this content:

```ts
import type { InspectProp, Token, TokenSet, TokenType } from "../../contracts/model.ts";

/** Token type offered for each Design panel property; properties not listed get no token suggestions. */
export const PROP_TOKEN_TYPE: Partial<Record<InspectProp, TokenType>> = {
  "color": "color", "background-color": "color",
  "width": "dimension", "height": "dimension", "max-width": "dimension", "gap": "dimension", "padding": "dimension",
  "margin": "dimension", "font-size": "dimension", "letter-spacing": "dimension", "border-radius": "dimension",
  "font-family": "fontFamily", "font-weight": "fontWeight", "line-height": "number", "opacity": "number",
};

/** "color.ink" → "--color-ink" (same rule as the engine's cssVarName). */
export function tokenVar(name: string): string {
  return "--" + name.replace(/[.\s]+/g, "-").toLowerCase();
}

/** `var(--name)` suggestions for a property, in token order. */
export function tokenOptions(tokens: TokenSet | null, prop: InspectProp): string[] {
  const type = PROP_TOKEN_TYPE[prop];
  if (!tokens || !type) return [];
  return tokens.tokens.filter((t) => t.type === type).map((t) => `var(${tokenVar(t.name)})`);
}

/** The token a `var(--x)` value points at, or null. */
export function tokenForValue(tokens: TokenSet | null, value: string): Token | null {
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
  if (!m || !tokens) return null;
  return tokens.tokens.find((t) => tokenVar(t.name) === m[1]) ?? null;
}
```

2. Replace the whole content of `src/ui/components/Field.tsx` with exactly:

```tsx
import { useEffect, useId, useRef, useState } from "react";
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
  /** Suggestions shown by the browser while typing (a <datalist>). */
  options?: readonly string[];
}
/**
 * Text field that commits on Enter or blur (only when the trimmed draft is not empty, differs from `value` and was
 * not just committed) and reverts on Escape.
 */
export function Field({ label, value, onCommit, prefix, suffix, override = false, mono = false, placeholder, testId, options }: FieldProps) {
  const listId = useId();
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
        list={options && options.length > 0 ? listId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); }
        }}
      />
      {suffix && <span className="m-field__suffix">{suffix}</span>}
      {options && options.length > 0 && (
        <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      )}
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

3. Replace the whole content of `src/ui/panels/DesignPanel.tsx` with exactly:

```tsx
import { Hash, Image, Link, RotateCcw, Rows3, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEST_IDS, useActions, useStudio } from "../../contracts/ui.tsx";
import { PROP_LABELS } from "../../contracts/model.ts";
import type { LayerKind } from "../../contracts/model.ts";
import { Button, cx } from "../components/Button.tsx";
import { Field, Section } from "../components/Field.tsx";
import { DESIGN_FIELDS, SCOPE_LABELS, SECTION_TITLES, fieldView, nodeAt, sectionsFor } from "./design-fields.ts";
import { ScopeControl } from "./ScopeControl.tsx";
import { tokenForValue, tokenOptions } from "./token-options.ts";
import "./design.css";

const KIND_ICONS: Record<LayerKind, LucideIcon> = { frame: Hash, stack: Rows3, text: Type, image: Image, link: Link };
const MONO = new Set(["grid-template-columns", "box-shadow", "font-family"]);

export function DesignPanel() {
  const actions = useActions();
  const selection = useStudio((s) => s.selection);
  const inspect = useStudio((s) => s.inspect);
  const tree = useStudio((s) => s.tree);
  const scope = useStudio((s) => s.scope);
  const tokens = useStudio((s) => s.tokens);
  if (selection === null) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Select a layer to edit its style.</div>;
  if (!inspect || inspect.path !== selection) return <div className="m-empty" data-testid={TEST_IDS.designPanel}>Loading styles…</div>;
  const kind = (tree && nodeAt(tree, selection)?.kind) || "frame";
  const Icon = KIND_ICONS[kind];
  return (
    <div className={cx("m-design", scope === "mobile" && "is-mobile")} data-testid={TEST_IDS.designPanel}>
      <header className="m-design-head">
        <Icon className="m-design-head__icon" aria-hidden="true" />
        <span className="m-design-head__name">{inspect.name}</span>
        <span className="m-design-head__tag">{inspect.tag}</span>
      </header>
      <ScopeControl />
      {sectionsFor(kind).map((section) => {
        const fields = DESIGN_FIELDS.filter((f) => f.section === section);
        const overridden = scope === "all" ? [] : fields.filter((f) => fieldView(inspect, f.prop, scope).override);
        return (
          <Section key={section} title={SECTION_TITLES[section]} testId={`design-${section}`}>
            <div className="m-grid2">
              {fields.map((f) => {
                const view = fieldView(inspect, f.prop, scope);
                const token = tokenForValue(tokens, view.value);
                return (
                  <div key={f.prop} className={f.wide ? "is-wide" : undefined}>
                    <Field label={f.label} prefix={f.prefix} value={view.value} override={view.override}
                      mono={MONO.has(f.prop) || token !== null} suffix={token?.value} options={tokenOptions(tokens, f.prop)}
                      onCommit={(value) => { void actions.applyStyle(f.prop, value); }} />
                  </div>
                );
              })}
            </div>
            {overridden.map((f) => {
              const label = PROP_LABELS[f.prop];
              return (
                <div key={f.prop} className={cx("m-override-note", scope === "mobile" && "is-mobile")}>
                  <span><span className="m-dot" />{`${label.charAt(0).toUpperCase()}${label.slice(1)} set for ${SCOPE_LABELS[scope]}. Desktop: ${fieldView(inspect, f.prop, scope).desktop ?? "none"}`}</span>
                  <Button size="sm" variant="ghost" onClick={() => { void actions.resetStyle(f.prop); }}><RotateCcw size={12} />Reset</Button>
                </div>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
```

4. Create `tests/e2e/tokens.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(`tests/.tmp/northfield/${f}`, "utf8");

test("lists project tokens and imports a Tokens Studio file", async ({ page }) => {
  const before = read("tokens.css");
  await page.goto("/");
  await page.getByTestId("left-panel").getByRole("tab", { name: "Assets" }).click();
  const panel = page.getByTestId("assets-panel");
  await expect(panel.locator('[data-token="color.ink"]')).toContainText("#1e2a22");
  const json = JSON.stringify({ core: { color: { ink: { value: "#102030", type: "color" } } } });
  await panel.getByLabel("Import tokens file").setInputFiles({ name: "tokens.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await expect(page.getByTestId("toast")).toContainText("Imported 1 tokens");
  expect(read("tokens.css")).toContain("--color-ink: #102030;");
  await expect(panel.locator('[data-token="color.ink"]')).toContainText("#102030");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(read("tokens.css")).toBe(before);
});

test("sets a property to a token variable", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  const size = page.getByLabel("Font size");
  await expect(size).toHaveValue("40px");
  await size.fill("var(--type-display)");
  await size.press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Saved to styles.css");
  expect(read("styles.css")).toContain("font-size: var(--type-display);");
  await expect(size).toHaveValue("var(--type-display)");
  await expect(page.getByTestId("design-text")).toContainText("40px");
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("toast")).toContainText("Undid:");
  expect(read("styles.css")).toContain("  font-size: 40px;");
});
```

5. Create `tests/ui/token-options.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { tokenForValue, tokenOptions, tokenVar } from "../../src/ui/panels/token-options.ts";
import { Field } from "../../src/ui/components/Field.tsx";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import { cssVarName } from "../../src/engine/tokens/dtcg.ts";

const tokens = parseDtcg(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"), "tokens.json");

describe("token options", () => {
  it("names variables like the engine", () => {
    for (const t of tokens.tokens) expect(tokenVar(t.name)).toBe(cssVarName(t.name));
  });
  it("offers tokens of the property's type", () => {
    expect(tokenOptions(tokens, "color")).toEqual(["var(--color-cream)", "var(--color-ink)", "var(--color-muted)", "var(--color-rust)"]);
    expect(tokenOptions(tokens, "font-size")).toEqual(["var(--space-4)", "var(--space-6)", "var(--type-display)"]);
    expect(tokenOptions(tokens, "display")).toEqual([]);
    expect(tokenOptions(null, "color")).toEqual([]);
  });
  it("finds the token behind a var() value", () => {
    expect(tokenForValue(tokens, "var(--type-display)")!.value).toBe("40px");
    expect(tokenForValue(tokens, "40px")).toBeNull();
  });
  it("renders field suggestions as a datalist", () => {
    render(<Field label="Fill" value="" options={["var(--color-ink)", "var(--color-rust)"]} onCommit={() => {}} />);
    const input = screen.getByLabelText("Fill");
    const list = document.getElementById(input.getAttribute("list")!)!;
    expect([...list.querySelectorAll("option")].map((o) => o.value)).toEqual(["var(--color-ink)", "var(--color-rust)"]);
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL offer only tokens of the property's type. (test: "offers tokens of the property's type")
- THE SYSTEM SHALL render field suggestions as a datalist. (test: "renders field suggestions as a datalist")
- WHEN a Tokens Studio file is imported in the browser THE SYSTEM SHALL rewrite tokens.css and list the new value; Undo restores it (verify: Playwright tokens.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T058`.
The last line must be `GATE PASS T058`. On `GATE FAIL T058 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T058` prints `GATE PASS T058`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T058: Suggest tokens in Design panel fields
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
