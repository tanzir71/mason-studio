# S003: Compose the studio, infrastructure and HTTP server in startMason

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S003 (seam), phase 2 |
| Depends on | T003, T004, T005, T012, T015, S001, S002 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S003: engine -> shell (compose): createStudio |
| Seam | S003-infra: infra -> shell (compose): createNodeFileSystem, createNodeGitRunner, createHttpLlmClient, createFileSettingsStore, createEventHub |
| Seam | S003-http: http -> shell (compose): createHttpServer |
| Requirements | R6, R9, R11 |

**Create:** `tests/integration/start.test.ts`

**Modify:** `src/server/start.ts`

**Read only:** `src/engine/studio/create-studio.ts`, `src/server/http/server.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S003`):

1. `npx vitest run tests/integration/start.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`startMason` builds the real studio on Node infrastructure, serves it over HTTP and opens the given project.

## Context

Seams engine → shell, infra → shell and http → shell (compose), planned as one card because they join at consecutive anchors in `src/server/start.ts` and only an end-to-end test proves them. `createNodeGitRunner`, `createHttpLlmClient` and `createProjectWatcher` are still stubs; this card only constructs git and LLM lazily through closures, so nothing calls them yet. S006 (MCP) and S007 (watcher) insert at later anchors.

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
/** src/server/http/server.ts — binds 127.0.0.1 only; see contracts/http.ts for routes. */
export type CreateHttpServer = (options: HttpServerOptions) => HttpServer;
export interface HttpServerOptions { studio: StudioService; events: EventHub; uiDir: string | null; mcp: McpHandler | null }
```

## Touch list

### src/server/start.ts (modify)

Anchor: `// @seam:imports`. Insert directly above it:

```ts
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createStudio } from "../engine/studio/create-studio.ts";
import { createNodeFileSystem } from "./infra/node-fs.ts";
import { createNodeGitRunner } from "./infra/git.ts";
import { createHttpLlmClient } from "./infra/llm.ts";
import { createFileSettingsStore } from "./infra/settings.ts";
import { createEventHub } from "./infra/events.ts";
import { createHttpServer } from "./http/server.ts";
import type { LlmClient } from "../contracts/ports.ts";
```

Anchor: `  // @seam:compose-core`. Insert directly above it:

```ts
  const hub = createEventHub();
  const settings = createFileSettingsStore(join(homeDir, "settings.json"));
  let llmClient: LlmClient | null = null;
  const llm: LlmClient = { complete: (messages) => (llmClient ??= createHttpLlmClient(async () => (await settings.load()).settings.agent)).complete(messages) };
  studio = createStudio({
    openFs: (root) => createNodeFileSystem(root),
    openGit: (root) => createNodeGitRunner(root),
    llm,
    settings,
    events: hub,
    templatesDir,
    now: () => Date.now(),
    newId: () => randomUUID(),
  });
```

`createHttpLlmClient` is still a stub that throws when it is called, so the block wraps it in a lazy `LlmClient`: it is created on the first `complete()` call (phase 9), and startup works today.

Anchor: `  // @seam:compose-server`. Insert directly above it:

```ts
  server = createHttpServer({ studio, events: hub, uiDir: existsSync(uiDir) ? uiDir : null, mcp });
```

Before:

```ts
  const onClose: (() => void)[] = [];
  // @seam:compose-core
  // @seam:compose-mcp
  // @seam:compose-server
  // @seam:compose-watch
```

After:

```ts
  const onClose: (() => void)[] = [];
  const hub = createEventHub();
  const settings = createFileSettingsStore(join(homeDir, "settings.json"));
  let llmClient: LlmClient | null = null;
  const llm: LlmClient = { complete: (messages) => (llmClient ??= createHttpLlmClient(async () => (await settings.load()).settings.agent)).complete(messages) };
  studio = createStudio({
    openFs: (root) => createNodeFileSystem(root),
    openGit: (root) => createNodeGitRunner(root),
    llm,
    settings,
    events: hub,
    templatesDir,
    now: () => Date.now(),
    newId: () => randomUUID(),
  });
  // @seam:compose-core
  // @seam:compose-mcp
  server = createHttpServer({ studio, events: hub, uiDir: existsSync(uiDir) ? uiDir : null, mcp });
  // @seam:compose-server
  // @seam:compose-watch
```

### tests/integration/start.test.ts (create)

Given in the steps.

## Steps

1. Apply the three insertions of the touch list to `src/server/start.ts`, in order. Keep every anchor line. Do not touch the `void ...;` line or the rest of the function.

2. Create `tests/integration/start.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import { rawRequest } from "../helpers/http.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function setup() {
  const base = mkdtempSync(join(tmpdir(), "mason-start-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  return { project: join(base, "north"), home: join(base, "home") };
}

describe("startMason", () => {
  it("starts on a free port and opens the given project", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    expect(running.url).toBe(`http://127.0.0.1:${running.port}/`);
    const r = await rawRequest(running.port, "POST", "/api/rpc/currentProject", { body: "{}" });
    expect(JSON.parse(r.body).result.pages.map((p: { name: string }) => p.name)).toEqual(["Home", "Menu"]);
  });
  it("serves project files through the real file system", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    const r = await rawRequest(running.port, "GET", "/p/styles.css");
    expect(r.body).toBe(readFileSync(join(project, "styles.css"), "utf8"));
  });
  it("stores recent projects in the home folder", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    expect(existsSync(join(home, "settings.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(home, "settings.json"), "utf8")).recent[0].name).toBe("north");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN startMason runs with port 0 and a project THE SYSTEM SHALL listen on a free port and open that project. (test: "starts on a free port and opens the given project")
- WHEN /p/styles.css is requested THE SYSTEM SHALL return the file from disk. (test: "serves project files through the real file system")
- THE SYSTEM SHALL store recent projects in <homeDir>/settings.json. (test: "stores recent projects in the home folder")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S003`.
The last line must be `GATE PASS S003`. On `GATE FAIL S003 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S003 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S003` prints `GATE PASS S003`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S003: Compose the studio, infrastructure and HTTP server in startMason
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
