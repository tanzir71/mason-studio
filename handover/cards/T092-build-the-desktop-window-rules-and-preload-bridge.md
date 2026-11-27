# T092: Build the desktop window rules and preload bridge

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T092 (build), phase 12 |
| Depends on | T091 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R38 |

**Create:** `src/desktop/window.ts`, `src/desktop/preload.ts`, `tests/desktop/window.test.ts`, `tests/desktop/preload.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T092`):

1. `npx vitest run tests/desktop/window.test.ts tests/desktop/preload.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`window.ts` defines the window options, argument parsing and link policy; `preload.ts` exposes only `masonDesktop.pickFolder()` to the page.

## Context

Desktop module (`src/desktop/`): an Electron 45 shell around the same local server and UI. The renderer is the normal web UI loaded from `http://127.0.0.1:<port>/`; the only native addition is a folder picker exposed as `window.masonDesktop` (see MasonDesktopBridge). Main and preload are bundled with esbuild into `dist/desktop/` (gitignored). The renderer stays sandboxed with context isolation; it never gets Node or Electron APIs.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
/** Electron preload bridge (src/desktop/preload.ts). Absent in the browser. */
export interface MasonDesktopBridge { isDesktop: true; pickFolder(): Promise<string | null> }
```

## Current state

`src/desktop/` does not exist. Electron's types come from the `electron` package.

## Steps

1. Create `src/desktop/window.ts` with exactly this content:

```ts
import type { BrowserWindowConstructorOptions } from "electron";

/** IPC channel of the folder picker (preload → main). */
export const PICK_FOLDER_CHANNEL = "mason:pick-folder";

/** Main window: 1440×900 (min 1024×640), Mason's dark background, isolated sandboxed renderer with the preload bridge. */
export function windowOptions(preload: string): BrowserWindowConstructorOptions {
  return {
    width: 1440, height: 900, minWidth: 1024, minHeight: 640, title: "Mason", backgroundColor: "#111110", show: true,
    webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  };
}

/** The first argument that is not a flag (the folder to open), or null. */
export function projectFromArgs(args: readonly string[]): string | null {
  return args.find((a) => !a.startsWith("-")) ?? null;
}

/** `--smoke`: start the server, check one RPC, print the result and exit without a window. */
export function isSmoke(args: readonly string[]): boolean {
  return args.includes("--smoke");
}

/** Same origin as the app → "allow" (a Mason window, e.g. Preview page); other http(s) → "external" browser; else "deny". */
export function decideWindowOpen(url: string, appOrigin: string): "allow" | "external" | "deny" {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "deny"; }
  if (parsed.origin === appOrigin) return "allow";
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? "external" : "deny";
}
```

2. Create `src/desktop/preload.ts` with exactly this content:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { MasonDesktopBridge } from "../contracts/ui.tsx";
import { PICK_FOLDER_CHANNEL } from "./window.ts";

/** The only thing the renderer gets from Electron: a folder picker. See MasonDesktopBridge. */
const bridge: MasonDesktopBridge = {
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke(PICK_FOLDER_CHANNEL) as Promise<string | null>,
};
contextBridge.exposeInMainWorld("masonDesktop", bridge);
```

3. Create `tests/desktop/window.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { PICK_FOLDER_CHANNEL, decideWindowOpen, isSmoke, projectFromArgs, windowOptions } from "../../src/desktop/window.ts";

describe("desktop window helpers", () => {
  it("isolates the renderer and loads the preload bridge", () => {
    const o = windowOptions("/app/dist/desktop/preload.cjs");
    expect([o.width, o.height, o.minWidth, o.minHeight, o.backgroundColor]).toEqual([1440, 900, 1024, 640, "#111110"]);
    expect(o.webPreferences).toMatchObject({ preload: "/app/dist/desktop/preload.cjs", contextIsolation: true, sandbox: true, nodeIntegration: false });
    expect(PICK_FOLDER_CHANNEL).toBe("mason:pick-folder");
  });
  it("reads the folder and the smoke flag from the arguments", () => {
    expect(projectFromArgs(["--no-sandbox", "/sites/north", "--smoke"])).toBe("/sites/north");
    expect(projectFromArgs(["--smoke"])).toBeNull();
    expect([isSmoke(["--smoke"]), isSmoke(["/x"])]).toEqual([true, false]);
  });
  it("keeps app windows inside Mason and sends other links to the browser", () => {
    const origin = "http://127.0.0.1:51234";
    expect(decideWindowOpen("http://127.0.0.1:51234/p/index.html", origin)).toBe("allow");
    expect(decideWindowOpen("https://penpot.app/", origin)).toBe("external");
    expect(decideWindowOpen("file:///etc/passwd", origin)).toBe("deny");
    expect(decideWindowOpen("not a url", origin)).toBe("deny");
  });
});
```

4. Create `tests/desktop/preload.test.ts` with exactly this content:

```ts
import { describe, expect, it, vi } from "vitest";

const exposeInMainWorld = vi.fn();
const invoke = vi.fn(async () => "/picked");
vi.mock("electron", () => ({ contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke } }));

describe("desktop preload", () => {
  it("exposes only the folder picker as window.masonDesktop", async () => {
    await import("../../src/desktop/preload.ts");
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, bridge] = exposeInMainWorld.mock.calls[0] as [string, { isDesktop: boolean; pickFolder(): Promise<string | null> }];
    expect(name).toBe("masonDesktop");
    expect(Object.keys(bridge).sort()).toEqual(["isDesktop", "pickFolder"]);
    expect(bridge.isDesktop).toBe(true);
    expect(await bridge.pickFolder()).toBe("/picked");
    expect(invoke).toHaveBeenCalledWith("mason:pick-folder");
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL open a sandboxed, context-isolated window with the preload bridge. (test: "isolates the renderer and loads the preload bridge")
- THE SYSTEM SHALL keep same-origin windows in Mason, open other http(s) links in the browser and deny the rest. (test: "keeps app windows inside Mason and sends other links to the browser")
- THE SYSTEM SHALL expose only isDesktop and pickFolder, which invokes mason:pick-folder. (test: "exposes only the folder picker as window.masonDesktop")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T092`.
The last line must be `GATE PASS T092`. On `GATE FAIL T092 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/desktop/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T092` prints `GATE PASS T092`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T092: Build the desktop window rules and preload bridge
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
