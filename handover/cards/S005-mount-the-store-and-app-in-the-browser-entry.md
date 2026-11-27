# S005: Mount the store and app in the browser entry

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S005 (seam), phase 3 |
| Depends on | T018, T021, T032, S003, S004 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S005: ui-api -> ui-shell (compose): createHttpClient |
| Seam | S005-state: ui-state -> ui-shell (compose): createStudioStore |
| Seam | S005-ui: ui -> ui-shell (compose): App |
| Requirements | R14, R15 |

**Create:** `tests/e2e/canvas.spec.ts`, `tests/ui/mount.test.tsx`

**Modify:** `src/ui/main.tsx`

**Read only:** `src/ui/app/App.tsx`, `src/ui/state/create-store.ts`, `src/ui/api/http-client.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S005`):

1. `npx vitest run tests/ui/mount.test.tsx` -> exit 0, output contains `Tests  2 passed (2)`
2. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
3. `npx vite build` -> exit 0, output contains `built in`
4. `npx playwright test canvas.spec.ts --project=chromium` -> exit 0, output contains `3 passed`, output does not contain `failed`
5. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Opening Mason in a browser shows the real app: the store is created from the HTTP client, server events reach `handleEvent`, and `init()` opens the current project.

## Context

Seams ui-api → ui-shell, ui-state → ui-shell and ui → ui-shell (compose), planned as one card because all three join in `src/ui/main.tsx` and only the end-to-end smoke test proves them. This card also adds the phase 3 Playwright smoke spec.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
/** src/ui/main.tsx — renders <App/> inside StudioContext into rootElement; returns an unmount function. */
export type MountStudio = (rootElement: HTMLElement, client: MasonClient) => () => void;
/** src/ui/api/http-client.ts */
export type CreateHttpClient = (baseUrl: string) => MasonClient;
/** src/ui/state/create-store.ts */
export type CreateStudioStore = (client: MasonClient) => StudioStore;
export const StudioContext = createContext<StudioStore | null>(null);
```

## Touch list

### src/ui/main.tsx (modify)

Anchor: `// @seam:imports`. Insert directly above it:

```tsx
import { App } from "./app/App.tsx";
import { createHttpClient } from "./api/http-client.ts";
import { createStudioStore } from "./state/create-store.ts";
```

Anchor: `  // @seam:mount`. Insert directly above it:

```tsx
  const store = createStudioStore(client);
  const offEvents = client.subscribe((event) => store.actions.handleEvent(event));
  void store.actions.init();
  root.render(<StrictMode><StudioContext.Provider value={store}><App /></StudioContext.Provider></StrictMode>);
  return () => { offEvents(); root.unmount(); };
```

Anchor: `// @seam:boot`. Insert directly above it:

```tsx
if (rootElement) mountStudio(rootElement, createHttpClient(""));
```

Before:

```tsx
  void client; void StudioContext;
  // @seam:mount
  root.render(<StrictMode><p>Mason is starting…</p></StrictMode>);
```

After:

```tsx
  void client; void StudioContext;
  const store = createStudioStore(client);
  const offEvents = client.subscribe((event) => store.actions.handleEvent(event));
  void store.actions.init();
  root.render(<StrictMode><StudioContext.Provider value={store}><App /></StudioContext.Provider></StrictMode>);
  return () => { offEvents(); root.unmount(); };
  // @seam:mount
  root.render(<StrictMode><p>Mason is starting…</p></StrictMode>);
```

The placeholder `root.render(<p>…)` line below the anchor becomes unreachable; leave it and the anchor exactly as they are.

### tests/e2e/canvas.spec.ts (create)

The complete file is given in the steps.

### tests/ui/mount.test.tsx (create)

The complete file is given in the steps.

## Steps

1. Apply the three insertions of the touch list to `src/ui/main.tsx`.

2. Create `tests/e2e/canvas.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";

test("opens the project on the canvas with three boards per page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("top-bar")).toContainText("northfield");
  for (const id of ["Home-desktop", "Home-tablet", "Home-mobile", "Menu-desktop"]) {
    await expect(page.getByTestId(`board-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("board-Home-desktop").locator("iframe")).toHaveAttribute("src", /\/p\/index\.html\?r=/);
  const heading = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(heading).toHaveText("Small-batch coffee, roasted down the street.");
});

test("selects a layer and outlines it on every board", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByTestId("layers-tree");
  for (const name of ["Main", "Hero", "Hero copy"]) {
    await tree.getByRole("treeitem", { name, exact: true }).getByRole("button", { name: "Expand" }).click();
  }
  await tree.getByRole("treeitem", { name: "Headline", exact: true }).click();
  await expect(tree.getByRole("treeitem", { name: "Headline", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("board-Home-desktop").getByTestId("overlay-selection")).toBeVisible();
  await expect(page.getByTestId("overlay-mirror")).toHaveCount(2);
  await page.getByTestId("breakpoint-strip").getByRole("button", { name: /Tablet/ }).click();
  await expect(page.getByTestId("board-Home-tablet").getByTestId("overlay-selection")).toBeVisible();
});

test("switches tools with shortcuts and opens another page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.getByRole("button", { name: "Hand (H)" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: "Move (V)" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("pages-list").getByRole("button", { name: /^Menu/ }).click();
  await expect(page.getByTestId("layers-tree").getByRole("treeitem").first()).toHaveText("Menu");
});
```

3. Create `tests/ui/mount.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mountStudio } from "../../src/ui/main.tsx";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ElementNode, ProjectInfo } from "../../src/contracts/model.ts";

const project: ProjectInfo = { root: "/p", name: "north", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };

describe("mountStudio", () => {
  it("renders the start screen when no project is open", async () => {
    const { client } = createFakeClient({ currentProject: async () => { throw new MasonError("NO_PROJECT"); } });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, client);
    await vi.waitFor(() => expect(el.querySelector('[data-testid="start-screen"]')).not.toBeNull());
    unmount();
    el.remove();
  });
  it("opens the canvas for the current project and unsubscribes on unmount", async () => {
    const { client } = createFakeClient({ currentProject: async () => project, pageTree: async () => ({ path: "", tag: "body", name: "Page", kind: "frame", children: [] } as unknown as ElementNode) });
    const off = vi.fn();
    const subscribe = vi.spyOn(client, "subscribe").mockReturnValue(off);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, client);
    await vi.waitFor(() => expect(el.querySelector('[data-testid="top-bar"]')).not.toBeNull());
    expect(el.textContent).toContain("north");
    expect(subscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(off).toHaveBeenCalledTimes(1);
    el.remove();
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN no project is open THE SYSTEM SHALL render the start screen. (test: "renders the start screen when no project is open")
- WHEN a project is open THE SYSTEM SHALL render the workspace and subscribe to events once, unsubscribing on unmount. (test: "opens the canvas for the current project and unsubscribes on unmount")
- WHEN Mason runs on the fixture THE SYSTEM SHALL show three boards per page, outline a selected layer on every board and switch tools by keyboard (verify: Playwright canvas.spec.ts, 3 tests).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S005`.
The last line must be `GATE PASS S005`. On `GATE FAIL S005 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S005 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S005` prints `GATE PASS S005`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S005: Mount the store and app in the browser entry
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
