# T093: Build the desktop main process and bundler

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T093 (build), phase 12 |
| Depends on | T092 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R38 |

**Create:** `src/desktop/main.ts`, `src/desktop/build.ts`, `tests/desktop/build.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T093`):

1. `npx vitest run tests/desktop/build.test.ts` -> exit 0, output contains `Tests  1 passed (1)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`main.ts` runs the Electron app lifecycle (window, folder picker, link policy, `--smoke`), and `build.ts` bundles main and preload into `dist/desktop/`.

## Context

Desktop module (`src/desktop/`): an Electron 45 shell around the same local server and UI. The renderer is the normal web UI loaded from `http://127.0.0.1:<port>/`; the only native addition is a folder picker exposed as `window.masonDesktop` (see MasonDesktopBridge). Main and preload are bundled with esbuild into `dist/desktop/` (gitignored). The server itself is composed by seam S008 at `// @seam:compose-desktop`; until then `startServer` throws.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface RunningMason { url: string; port: number; studio: StudioService; close(): Promise<void> }
export interface StartOptions { port: number; project: string | null; homeDir: string | null; uiDir: string | null }
```

## Current state

`src/desktop/window.ts` exports `PICK_FOLDER_CHANNEL`, `windowOptions`, `projectFromArgs`, `isSmoke`, `decideWindowOpen`; `src/desktop/preload.ts` exists. esbuild 0.28.2 is installed.

## Steps

1. Create `src/desktop/main.ts` with exactly this content:

```ts
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunningMason } from "../contracts/ports.ts";
import { PICK_FOLDER_CHANNEL, decideWindowOpen, isSmoke, projectFromArgs, windowOptions } from "./window.ts";
// @seam:imports

/** dist/desktop when bundled; the UI build sits next to it in dist/ui. */
const here = dirname(fileURLToPath(import.meta.url));
let running: RunningMason | null = null;

/** Starts the local Mason server for the desktop app (composed by the desktop seam card). */
async function startServer(project: string | null): Promise<RunningMason> {
  void project;
  // @seam:compose-desktop
  throw new Error("The Mason server is not composed yet.");
}

/** `--smoke`: one RPC round trip, then exit 0 (prints MASON SMOKE OK) or 1. */
async function smoke(r: RunningMason): Promise<void> {
  const res = await fetch(`${r.url}api/rpc/templates`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const ok = res.ok && Array.isArray(((await res.json()) as { result?: unknown }).result);
  console.log(ok ? "MASON SMOKE OK" : `MASON SMOKE FAILED ${res.status}`);
  await r.close();
  app.exit(ok ? 0 : 1);
}

function openWindow(r: RunningMason): void {
  const win = new BrowserWindow(windowOptions(join(here, "preload.cjs")));
  const origin = new URL(r.url).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url, origin);
    if (decision === "external") void shell.openExternal(url);
    return { action: decision === "allow" ? "allow" : "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => { if (decideWindowOpen(url, origin) !== "allow") event.preventDefault(); });
  void win.loadURL(r.url);
}

async function boot(): Promise<void> {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  const project = projectFromArgs(args);
  running = await startServer(project ? resolve(project) : null);
  if (isSmoke(args)) { await smoke(running); return; }
  ipcMain.handle(PICK_FOLDER_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  openWindow(running);
}

app.whenReady().then(boot).catch((error: unknown) => { console.error(error); app.exit(1); });
app.on("window-all-closed", () => { void running?.close(); app.quit(); });
```

2. Create `src/desktop/build.ts` with exactly this content:

```ts
import { build } from "esbuild";

/**
 * Bundles the Electron entry points into dist/desktop:
 * - main.mjs (ESM; npm packages stay external and load from node_modules; start.ts's REPO_ROOT still resolves two folders up)
 * - preload.cjs (CommonJS, required for sandboxed preloads; only `electron` is external)
 */
await build({
  entryPoints: ["src/desktop/main.ts"], outfile: "dist/desktop/main.mjs", bundle: true, platform: "node",
  format: "esm", target: "node22", packages: "external", sourcemap: true, logLevel: "warning",
});
await build({
  entryPoints: ["src/desktop/preload.ts"], outfile: "dist/desktop/preload.cjs", bundle: true, platform: "node",
  format: "cjs", target: "node22", external: ["electron"], logLevel: "warning",
});
console.log("built dist/desktop");
```

3. Create `tests/desktop/build.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

describe("desktop bundle", () => {
  it("bundles main as ESM and the preload as CommonJS", () => {
    const out = execFileSync(process.execPath, ["src/desktop/build.ts"], { encoding: "utf8" });
    expect(out).toContain("built dist/desktop");
    const main = readFileSync("dist/desktop/main.mjs", "utf8");
    expect(main).toMatch(/from "electron"/);
    expect(main).toContain("MASON SMOKE OK");
    expect(main).not.toContain('require("electron")');
    const preload = readFileSync("dist/desktop/preload.cjs", "utf8");
    expect(preload).toContain('require("electron")');
    expect(preload).toContain("masonDesktop");
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN build.ts runs THE SYSTEM SHALL write dist/desktop/main.mjs (ESM, electron external) and dist/desktop/preload.cjs (CommonJS). (test: "bundles main as ESM and the preload as CommonJS")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T093`.
The last line must be `GATE PASS T093`. On `GATE FAIL T093 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/desktop/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T093` prints `GATE PASS T093`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T093: Build the desktop main process and bundler
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
