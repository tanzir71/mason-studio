# T014: Serve project files and the built UI

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T014 (build), phase 2 |
| Depends on | T013 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R10, R11 |

**Create:** `src/server/http/static.ts`, `tests/http/static.test.ts`

**Modify:** `src/server/http/server.ts`

**Read only:** `tests/helpers/http.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T014`):

1. `npx vitest run tests/http/static.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

GET `/p/<path>` serves files of the open project and every other GET serves the built UI with an index.html fallback.

## Context

HTTP module. Boards are iframes pointing at `/p/<page file>`, so project files must never be cached. The UI is the Vite build in `dist/ui`. Registers at the anchors T013 created in `server.ts` (same module).

## Contracts (do not modify)

```ts
// src/contracts/http.ts
/**
 * Routes (all on 127.0.0.1; requests whose Host header is not `127.0.0.1:<port>` or `localhost:<port>` → 403
 * text "Forbidden host"):
 * - POST /api/rpc/<method>  body { "args": [...] } → 200 { "result": value }; MasonError → ERROR_STATUS[code]
 *   with { "error": { "code", "message" } }; unknown method → 404 UNKNOWN_METHOD; other errors → 500 { "error": { "code": "INTERNAL", "message" } }.
 * - GET /api/events  Server-Sent Events: each MasonEvent as `data: <json>\n\n`; a `: ping\n\n` comment every 15 s.
 * - GET /p/<path>    raw project file from the open project (404 when missing or no project; ".." → 403).
 * - POST /mcp        MCP JSON-RPC (see contracts/mcp.ts); 404 when the server has no MCP handler.
 * - GET anything else → file from uiDir, falling back to uiDir/index.html; 404 when uiDir is null.
 */
export const ROUTES = { rpc: "/api/rpc/", events: "/api/events", project: "/p/", mcp: "/mcp" } as const;
/** MIME types for static files by extension; anything else → "application/octet-stream". */
export const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};
```

```ts
// src/contracts/ports.ts
export interface HttpServerOptions { studio: StudioService; events: EventHub; uiDir: string | null; mcp: McpHandler | null }
```

## Current state

`src/server/http/server.ts` (T013) exports `createHttpServer`, `sendText`, `sendJson`, `Route`, `RouteHandler`. Inside `createHttpServer` the lines are:

```ts
  // @seam:routes
  let fallback: RouteHandler = (_req, res) => sendText(res, 404, "Not found");
  // @seam:fallback
```

## Steps

1. Create `src/server/http/static.ts` exporting two functions:
   - `serveProjectFile(studio: StudioService, rel: string, res: ServerResponse): Promise<void>`: `rel` is the URL path after `/p/`; decode it with `decodeURIComponent`; if any `/`-separated segment is `..` → `sendText(res, 403, "Forbidden")`. Get `root` from `await studio.currentProject()` (any error → 404 "Not found"). Read `join(root, rel)` with `readFile` from `node:fs/promises` (any error → 404 "Not found"). Answer 200 with headers `content-type: MIME[extname(rel).toLowerCase()] ?? "application/octet-stream"` and `cache-control: no-store`.
   - `serveUi(uiDir: string | null, pathname: string, res: ServerResponse): Promise<void>`: `uiDir` null → 404 "Not found". `rel` = decoded pathname without the leading `/`; empty → `index.html`; a `..` segment → 403. If `join(uiDir, rel)` is an existing file, serve it with its MIME type; else serve `join(uiDir, "index.html")` as `text/html; charset=utf-8`; if that is missing → 404 "Not found".

2. In `src/server/http/server.ts` insert `import { serveProjectFile, serveUi } from "./static.ts";` directly above `// @seam:imports`.

3. Insert directly above `// @seam:routes`:
```ts
  routes.push({ method: "GET", prefix: ROUTES.project, exact: false, handle: (_req, res, url) => serveProjectFile(options.studio, url.pathname.slice(ROUTES.project.length), res) });
```

4. Insert directly above `// @seam:fallback`:
```ts
  fallback = (_req, res, url) => serveUi(options.uiDir, url.pathname, res);
```

5. Create `tests/http/static.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "../../src/server/http/server.ts";
import { createFakeStudio, MemoryEventHub } from "../../src/contracts/fakes.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import type { HttpServer } from "../../src/contracts/ports.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { rawRequest } from "../helpers/http.ts";

let server: HttpServer | null = null;
const dirs: string[] = [];
afterEach(async () => { await server?.close(); server = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "mason-static-")); dirs.push(d); return d; };

async function start(projectRoot: string | null, uiDir: string | null) {
  const studio = createFakeStudio({
    currentProject: async () => { if (!projectRoot) throw new MasonError("NO_PROJECT"); return { root: projectRoot } as ProjectInfo; },
  });
  server = createHttpServer({ studio, events: new MemoryEventHub(), uiDir, mcp: null });
  return server.listen(0);
}

describe("static routes", () => {
  it("serves project files with their MIME type and no-store caching", async () => {
    const root = tmp();
    mkdirSync(join(root, "css"));
    writeFileSync(join(root, "css", "a.css"), "a{}");
    const port = await start(root, null);
    const r = await rawRequest(port, "GET", "/p/css/a.css");
    expect([r.status, r.body, r.headers["content-type"], r.headers["cache-control"]]).toEqual([200, "a{}", "text/css; charset=utf-8", "no-store"]);
  });
  it("answers 404 for missing project files and when no project is open", async () => {
    const port = await start(tmp(), null);
    expect((await rawRequest(port, "GET", "/p/missing.html")).status).toBe(404);
    await server!.close();
    const port2 = await start(null, null);
    expect((await rawRequest(port2, "GET", "/p/index.html")).status).toBe(404);
  });
  it("refuses project paths that escape the folder", async () => {
    const port = await start(tmp(), null);
    expect((await rawRequest(port, "GET", "/p/..%2fsecret.txt")).status).toBe(403);
  });
  it("serves UI files and falls back to index.html", async () => {
    const ui = tmp();
    mkdirSync(join(ui, "assets"));
    writeFileSync(join(ui, "index.html"), "<p>ui</p>");
    writeFileSync(join(ui, "assets", "app.js"), "1;");
    const port = await start(null, ui);
    expect((await rawRequest(port, "GET", "/assets/app.js")).headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect((await rawRequest(port, "GET", "/")).body).toBe("<p>ui</p>");
    expect((await rawRequest(port, "GET", "/some/route")).body).toBe("<p>ui</p>");
  });
  it("answers 404 for UI requests without a UI folder", async () => {
    const port = await start(null, null);
    expect((await rawRequest(port, "GET", "/")).status).toBe(404);
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- WHEN GET /p/<path> names an existing project file THE SYSTEM SHALL return it with its MIME type and `cache-control: no-store`. (test: "serves project files with their MIME type and no-store caching")
- IF the file is missing or no project is open THEN THE SYSTEM SHALL answer 404. (test: "answers 404 for missing project files and when no project is open")
- IF the path contains a .. segment THEN THE SYSTEM SHALL answer 403. (test: "refuses project paths that escape the folder")
- WHEN any other GET arrives THE SYSTEM SHALL serve the UI file or index.html. (test: "serves UI files and falls back to index.html")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T014`.
The last line must be `GATE PASS T014`. On `GATE FAIL T014 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/http/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T014` prints `GATE PASS T014`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T014: Serve project files and the built UI
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
