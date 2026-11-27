# T002: Create module stubs and seam anchors

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T002 (skeleton), phase 1 |
| Depends on | T001 |
| Effort | high |
| Budget | 3 non-test files, ~350 changed lines, 60 turns, 3 fix attempts |

**Create:** `src/engine/studio/context.ts`, `src/engine/studio/create-studio.ts`, `src/server/infra/node-fs.ts`, `src/server/infra/git.ts`, `src/server/infra/llm.ts`, `src/server/infra/settings.ts`, `src/server/infra/events.ts`, `src/server/infra/watcher.ts`, `src/server/http/server.ts`, `src/server/mcp/handler.ts`, `src/server/start.ts`, `src/ui/api/http-client.ts`, `src/ui/state/create-store.ts`, `src/ui/app/App.tsx`, `src/ui/main.tsx`, `src/ui/index.html`, `src/ui/styles/global.css`, `tests/skeleton.test.ts`, `tests/skeleton-ui.test.tsx`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T002`):

1. `npx vitest run tests/skeleton.test.ts tests/skeleton-ui.test.tsx` -> exit 0, output contains `Tests  7 passed (7)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Every cross-module entry point exists at its final path with its contract signature, the composition roots hold their `@seam:` anchors, and the skeleton tests pass (7 tests). The skeleton tests check only facts that stay true after later cards replace the stubs.

## Context

Second card. Phase 2+ build cards fill these stubs; seam cards S003-S008 insert code at the anchors in `src/server/start.ts` and `src/ui/main.tsx`, and engine group cards insert at `@seam:groups` in `src/engine/studio/create-studio.ts`. Create every file byte for byte.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface StudioDeps {
  openFs(root: string): FileSystem;     // file system rooted at a project folder
  openGit(root: string): GitRunner;
  llm: LlmClient;
  settings: SettingsStore;
  events: EventSink;
  templatesDir: string;                 // absolute path of the repo's templates/ folder
  now(): number;
  newId(): string;
}
/** src/engine/studio/create-studio.ts */
export type CreateStudio = (deps: StudioDeps) => StudioService;
export interface StartOptions { port: number; project: string | null; homeDir: string | null; uiDir: string | null }
export interface RunningMason { url: string; port: number; studio: StudioService; close(): Promise<void> }
/** src/server/start.ts — composition root. homeDir null → MASON_HOME env var or ~/.mason; uiDir null → <repo>/dist/ui. */
export type StartMason = (options: StartOptions) => Promise<RunningMason>;
```

```tsx
// src/contracts/ui.tsx
/** src/ui/main.tsx — renders <App/> inside StudioContext into rootElement; returns an unmount function. */
export type MountStudio = (rootElement: HTMLElement, client: MasonClient) => () => void;
```

## Current state

Only the toolchain from T001 exists. None of the files below exist yet.

## Steps

1. Create `src/engine/studio/context.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { ProjectInfo, Proposal } from "../../contracts/model.ts";
import type { FileSystem, StudioDeps } from "../../contracts/ports.ts";

/** One undo step: every file it touched, with its text before (null = file did not exist) and after. */
export interface HistoryStep { files: { path: string; before: string | null; after: string }[]; message: string }

/** Mutable state shared by every studio group. Created once per createStudio call. */
export interface EngineContext {
  deps: StudioDeps;
  project: ProjectInfo | null;
  fs: FileSystem | null;
  undoStack: HistoryStep[];
  redoStack: HistoryStep[];
  revision: number;
  proposals: Proposal[]; // newest first
}

export function createEngineContext(deps: StudioDeps): EngineContext {
  return { deps, project: null, fs: null, undoStack: [], redoStack: [], revision: 0, proposals: [] };
}

/** The open project's file system, or NO_PROJECT. */
export function requireFs(ctx: EngineContext): FileSystem {
  if (!ctx.fs || !ctx.project) throw new MasonError("NO_PROJECT");
  return ctx.fs;
}

/** The open project, or NO_PROJECT. */
export function requireProject(ctx: EngineContext): ProjectInfo {
  if (!ctx.fs || !ctx.project) throw new MasonError("NO_PROJECT");
  return ctx.project;
}
```

2. Create `src/engine/studio/create-studio.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { STUDIO_METHODS } from "../../contracts/ports.ts";
import type { CreateStudio, StudioDeps, StudioService } from "../../contracts/ports.ts";
import { createEngineContext } from "./context.ts";
// @seam:imports

/** Every method rejects NOT_IMPLEMENTED until its group is assigned above `@seam:groups`. */
export const createStudio: CreateStudio = (deps: StudioDeps): StudioService => {
  const ctx = createEngineContext(deps);
  const studio: Record<string, unknown> = {};
  for (const m of STUDIO_METHODS) studio[m] = async () => { throw new MasonError("NOT_IMPLEMENTED", m); };
  // @seam:groups
  return studio as unknown as StudioService;
};
```

3. Create `src/server/infra/node-fs.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeFileSystem } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createNodeFileSystem: CreateNodeFileSystem = (_root) => {
  throw new MasonError("NOT_IMPLEMENTED", "createNodeFileSystem");
};
```

4. Create `src/server/infra/git.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeGitRunner } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createNodeGitRunner: CreateNodeGitRunner = (_root) => {
  throw new MasonError("NOT_IMPLEMENTED", "createNodeGitRunner");
};
```

5. Create `src/server/infra/llm.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpLlmClient } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createHttpLlmClient: CreateHttpLlmClient = (_getAgent) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpLlmClient");
};
```

6. Create `src/server/infra/settings.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateFileSettingsStore } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createFileSettingsStore: CreateFileSettingsStore = (_filePath) => {
  throw new MasonError("NOT_IMPLEMENTED", "createFileSettingsStore");
};
```

7. Create `src/server/infra/events.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateEventHub } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createEventHub: CreateEventHub = () => {
  throw new MasonError("NOT_IMPLEMENTED", "createEventHub");
};
```

8. Create `src/server/infra/watcher.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateProjectWatcher } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createProjectWatcher: CreateProjectWatcher = (_events) => {
  throw new MasonError("NOT_IMPLEMENTED", "createProjectWatcher");
};
```

9. Create `src/server/http/server.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpServer } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createHttpServer: CreateHttpServer = (_options) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpServer");
};
```

10. Create `src/server/mcp/handler.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateMcpHandler } from "../../contracts/ports.ts";

/** Stub: implemented by a later card. */
export const createMcpHandler: CreateMcpHandler = (_studio, _options) => {
  throw new MasonError("NOT_IMPLEMENTED", "createMcpHandler");
};
```

11. Create `src/server/start.ts` with exactly this content:

```ts
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MasonError } from "../contracts/errors.ts";
import { HOST } from "../contracts/http.ts";
import type { HttpServer, McpHandler, RunningMason, StartMason, StartOptions, StudioService } from "../contracts/ports.ts";
// @seam:imports

export const MASON_VERSION = "0.1.0";
/** Repository root: two folders above this file. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Composition root. Seam cards insert code above the four compose anchors, in this order. */
export const startMason: StartMason = async (options: StartOptions): Promise<RunningMason> => {
  const homeDir = options.homeDir ?? process.env.MASON_HOME ?? join(homedir(), ".mason");
  const uiDir = options.uiDir ?? join(REPO_ROOT, "dist", "ui");
  const templatesDir = join(REPO_ROOT, "templates");
  let studio: StudioService | null = null;
  let mcp: McpHandler | null = null;
  let server: HttpServer | null = null;
  const onClose: (() => void)[] = [];
  // @seam:compose-core
  // @seam:compose-mcp
  // @seam:compose-server
  // @seam:compose-watch
  void homeDir; void uiDir; void templatesDir; void mcp;
  if (!studio || !server) throw new MasonError("NOT_IMPLEMENTED", "startMason");
  const readyStudio: StudioService = studio;
  const readyServer: HttpServer = server;
  const port = await readyServer.listen(options.port);
  if (options.project) await readyStudio.openProject(options.project);
  return {
    url: `http://${HOST}:${port}/`,
    port,
    studio: readyStudio,
    close: async () => {
      for (const fn of onClose) fn();
      await readyServer.close();
    },
  };
};
```

12. Create `src/ui/api/http-client.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpClient } from "../../contracts/ui.tsx";

/** Stub: implemented by a later card. */
export const createHttpClient: CreateHttpClient = (_baseUrl) => {
  throw new MasonError("NOT_IMPLEMENTED", "createHttpClient");
};
```

13. Create `src/ui/state/create-store.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateStudioStore } from "../../contracts/ui.tsx";

/** Stub: implemented by a later card. */
export const createStudioStore: CreateStudioStore = (_client) => {
  throw new MasonError("NOT_IMPLEMENTED", "createStudioStore");
};
```

14. Create `src/ui/app/App.tsx` with exactly this content:

```tsx
import { TEST_IDS } from "../../contracts/ui.tsx";

/** Stub: replaced by the App card. */
export function App() {
  return <div data-testid={TEST_IDS.startScreen}>Mason</div>;
}
```

15. Create `src/ui/main.tsx` with exactly this content:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioContext } from "../contracts/ui.tsx";
import type { MasonClient, MountStudio } from "../contracts/ui.tsx";
import "./styles/global.css";
// @seam:imports

/** Renders the studio into rootElement and returns an unmount function. */
export const mountStudio: MountStudio = (rootElement: HTMLElement, client: MasonClient) => {
  const root = createRoot(rootElement);
  void client; void StudioContext;
  // @seam:mount
  root.render(<StrictMode><p>Mason is starting…</p></StrictMode>);
  return () => root.unmount();
};

const rootElement = typeof document === "undefined" ? null : document.getElementById("root");
void rootElement;
// @seam:boot
```

16. Create `src/ui/index.html` with exactly this content:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mason</title>
  <link rel="icon" href="data:,">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

17. Create `src/ui/styles/global.css` with exactly this content:

```css
@import "../../contracts/tokens.css";

*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg-app);
  color: var(--text-default);
  font: var(--text-13);
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms; animation-duration: 0.01ms; }
}
```

18. Create `tests/skeleton.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../src/engine/studio/create-studio.ts";
import { createEngineContext, requireFs } from "../src/engine/studio/context.ts";
import { createNodeFileSystem } from "../src/server/infra/node-fs.ts";
import { createNodeGitRunner } from "../src/server/infra/git.ts";
import { createHttpLlmClient } from "../src/server/infra/llm.ts";
import { createFileSettingsStore } from "../src/server/infra/settings.ts";
import { createEventHub } from "../src/server/infra/events.ts";
import { createProjectWatcher } from "../src/server/infra/watcher.ts";
import { createHttpServer } from "../src/server/http/server.ts";
import { createMcpHandler } from "../src/server/mcp/handler.ts";
import { MASON_VERSION, REPO_ROOT, startMason } from "../src/server/start.ts";
import { STUDIO_METHODS } from "../src/contracts/ports.ts";
import { createTestDeps } from "../src/contracts/fakes.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("skeleton", () => {
  it("createStudio exposes every StudioService method as a function", () => {
    const studio = createStudio(createTestDeps());
    for (const m of STUDIO_METHODS) expect(typeof studio[m]).toBe("function");
  });
  it("engine context starts empty and requires a project", () => {
    const ctx = createEngineContext(createTestDeps());
    expect(ctx.revision).toBe(0);
    expect(() => requireFs(ctx)).toThrow("No project is open.");
  });
  it("every server entry point is exported as a function", () => {
    const entries = [createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub,
      createProjectWatcher, createHttpServer, createMcpHandler, startMason];
    for (const f of entries) expect(typeof f).toBe("function");
  });
  it("REPO_ROOT points at the repository", () => {
    expect(MASON_VERSION).toBe("0.1.0");
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
  });
});
```

19. Create `tests/skeleton-ui.test.tsx` with exactly this content:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "../src/ui/app/App.tsx";
import { mountStudio } from "../src/ui/main.tsx";
import { createHttpClient } from "../src/ui/api/http-client.ts";
import { createStudioStore } from "../src/ui/state/create-store.ts";
import { createFakeClient } from "../src/contracts/fakes-ui.ts";

describe("ui skeleton", () => {
  it("UI entry points are exported as functions", () => {
    for (const f of [App, mountStudio, createHttpClient, createStudioStore]) expect(typeof f).toBe("function");
  });
  it("index.html mounts main.tsx into #root", () => {
    const html = readFileSync("src/ui/index.html", "utf8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="./main.tsx"');
  });
  it("mountStudio renders into the element and unmounts", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, createFakeClient().client);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.childNodes.length).toBeGreaterThan(0);
    unmount();
    expect(el.innerHTML).toBe("");
    el.remove();
  });
});
```

20. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL expose every StudioService method from createStudio as a function. (test: "createStudio exposes every StudioService method as a function")
- THE SYSTEM SHALL export every server entry point at its final path. (test: "every server entry point is exported as a function")
- WHEN mountStudio renders THE SYSTEM SHALL put content into the element and clear it on unmount. (test: "mountStudio renders into the element and unmounts")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T002`.
The last line must be `GATE PASS T002`. On `GATE FAIL T002 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not implement any stub; later cards do that.
- Do not remove or rename any `@seam:` anchor line or the `void ...;` lines.

## Done when

- `verify.ps1 -Card T002` prints `GATE PASS T002`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T002: Create module stubs and seam anchors
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
