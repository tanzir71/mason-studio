# S007: Compose the project watcher in startMason

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S007 (seam), phase 10 |
| Depends on | T086, S006, T082, T085 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S007: infra -> shell (compose): createProjectWatcher, suppressOwnWrites |
| Requirements | R36, R35, R34 |

**Create:** `tests/e2e/start.spec.ts`, `tests/integration/watch.test.ts`

**Modify:** `src/server/start.ts`

**Read only:** `src/server/infra/watcher.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S007`):

1. `npx vitest run tests/integration/watch.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
3. `npx vite build` -> exit 0, output contains `built in`
4. `npx playwright test start.spec.ts --project=chromium` -> exit 0, output contains `3 passed`, output does not contain `failed`
5. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Mason watches the open project: outside edits reload the boards, Mason's own saves do not reload them twice; the phase 10 smoke test covers the start screen, outside edits and Git.

## Context

Seam infra → shell (compose). The watcher follows `project-opened` events, so opening another project moves the watch. `close()` stops it.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export type CreateProjectWatcher = (events: EventSink) => ProjectWatcher;
/** src/server/infra/watcher.ts — fs.watch(root, { recursive: true }); emits { type: "external-change", files } debounced 150 ms, ignoring .git/ and node_modules/. */
export interface ProjectWatcher { watch(root: string): void; close(): void }
```

## Touch list

### src/server/start.ts (modify)

Anchor: `// @seam:imports`. Insert directly above it:

```ts
import { createProjectWatcher, suppressOwnWrites } from "./infra/watcher.ts";
```

Anchor: `  // @seam:compose-watch`. Insert directly above it:

```ts
  const watcher = createProjectWatcher(suppressOwnWrites(hub));
  hub.subscribe((e) => { if (e.type === "project-opened") watcher.watch(e.project.root); });
  onClose.push(() => watcher.close());
```

Before:

```ts
  // @seam:compose-server
  // @seam:compose-watch
```

After:

```ts
  // @seam:compose-server
  const watcher = createProjectWatcher(suppressOwnWrites(hub));
  hub.subscribe((e) => { if (e.type === "project-opened") watcher.watch(e.project.root); });
  onClose.push(() => watcher.close());
  // @seam:compose-watch
```

### tests/e2e/start.spec.ts (create)

The complete file is given in the steps.

### tests/integration/watch.test.ts (create)

The complete file is given in the steps.

## Steps

1. Apply both insertions of the touch list to `src/server/start.ts`.

2. Create `tests/e2e/start.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test("closes the project to the start screen and reopens it from recent", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("top-bar").getByRole("button", { name: "northfield" }).click();
  await page.getByRole("menuitem", { name: "Close project" }).click();
  const start = page.getByTestId("start-screen");
  await expect(start.getByRole("heading", { name: "Start designing" })).toBeVisible();
  await expect(start.getByRole("button", { name: "Landing page 1 page" })).toBeVisible();
  await start.getByRole("button", { name: /northfield/ }).click();
  await expect(page.getByTestId("board-Home-desktop")).toBeVisible();
});

test("reloads boards when a file changes outside Mason", async ({ page }) => {
  const file = "tests/.tmp/northfield/styles.css";
  const original = readFileSync(file, "utf8");
  await page.goto("/");
  const h1 = page.getByTestId("board-Home-desktop").frameLocator("iframe").locator("h1");
  await expect(h1).toHaveCSS("font-size", "40px");
  writeFileSync(file, original.replace("  font-size: 40px;", "  font-size: 44px;"));
  await expect(h1).toHaveCSS("font-size", "44px");
  writeFileSync(file, original);
  await expect(h1).toHaveCSS("font-size", "40px");
});

test("shows Git changes and commits them", async ({ page }) => {
  await page.goto("/");
  const chip = page.getByTestId("git-chip");
  await expect(chip).toContainText("7 changes");
  await chip.getByRole("button", { name: "Commit" }).click();
  await page.getByLabel("Commit message").fill("Start the Northfield site");
  await page.getByLabel("Commit message").press("Enter");
  await expect(page.getByTestId("toast")).toContainText("Committed");
  await expect(chip).toContainText("0 changes");
});
```

3. Create `tests/integration/watch.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start() {
  const base = mkdtempSync(join(tmpdir(), "mason-watch-int-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  running = await startMason({ port: 0, project: join(base, "north"), homeDir: join(base, "home"), uiDir: null });
  return { m: running, root: join(base, "north") };
}

/** Collects events from the server's /api/events stream. */
async function listen(port: number): Promise<{ events: MasonEvent[]; stop(): void }> {
  const events: MasonEvent[] = [];
  const controller = new AbortController();
  const res = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value);
        let i;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          if (chunk.startsWith("data: ")) events.push(JSON.parse(chunk.slice(6)));
        }
      }
    } catch { /* aborted */ }
  })();
  return { events, stop: () => controller.abort() };
}

describe("project watcher in startMason", () => {
  it("reports files changed by other programs", async () => {
    const { m, root } = await start();
    const l = await listen(m.port);
    await wait(150);
    writeFileSync(join(root, "styles.css"), "body { margin: 0; }\n");
    await wait(800);
    l.stop();
    expect(l.events).toContainEqual({ type: "external-change", files: ["styles.css"] });
  });
  it("does not report Mason's own writes as external", async () => {
    const { m } = await start();
    const l = await listen(m.port);
    await wait(150);
    await m.studio.applyStyle({ page: "Home", path: "1.0.0.1", prop: "font-size", value: "44px", scope: "all" });
    await wait(800);
    l.stop();
    expect(l.events.map((e) => e.type)).toEqual(["written"]);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN another program changes a project file THE SYSTEM SHALL stream an external-change event. (test: "reports files changed by other programs")
- WHEN Mason writes a file itself THE SYSTEM SHALL stream only the written event. (test: "does not report Mason's own writes as external")
- WHEN styles.css changes on disk THE SYSTEM SHALL reload the boards; the start screen reopens a recent project; Git changes can be committed (verify: Playwright start.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S007`.
The last line must be `GATE PASS S007`. On `GATE FAIL S007 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S007 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S007` prints `GATE PASS S007`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S007: Compose the project watcher in startMason
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
