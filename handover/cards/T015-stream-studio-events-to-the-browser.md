# T015: Stream studio events to the browser

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T015 (build), phase 2 |
| Depends on | T014 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R12 |

**Create:** `src/server/http/events.ts`, `tests/http/events.test.ts`

**Modify:** `src/server/http/server.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T015`):

1. `npx vitest run tests/http/events.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

GET `/api/events` streams every MasonEvent as a server-sent event until the client disconnects.

## Context

HTTP module. The UI subscribes to it (phase 3) to reload boards after writes, external file changes and new proposals. Registers at `@seam:routes` in `server.ts` (same module).

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
```

```ts
// src/contracts/ports.ts
/** In-process pub/sub. subscribe returns an unsubscribe function; listeners run synchronously in subscribe order. */
export interface EventHub extends EventSink { subscribe(listener: (event: MasonEvent) => void): () => void }
```

```ts
// src/contracts/model.ts
export type MasonEvent =
  | { type: "written"; files: string[]; revision: number }
```

## Current state

`src/server/http/server.ts` has `import { serveProjectFile, serveUi } from "./static.ts";` above `// @seam:imports` and the `/p/` route push above `// @seam:routes`. Its `close()` destroys every open socket before closing.

## Steps

1. Create `src/server/http/events.ts` exporting `handleEvents(req: IncomingMessage, res: ServerResponse, hub: EventHub): void`:
   - `res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" })`, then `res.write(": connected\n\n")`.
   - `const off = hub.subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`))`.
   - `const timer = setInterval(() => res.write(": ping\n\n"), 15000)`.
   - On `req.on("close")`: `clearInterval(timer)` and `off()`.

2. In `src/server/http/server.ts` insert `import { handleEvents } from "./events.ts";` directly above `// @seam:imports`, and directly above `// @seam:routes` insert:
```ts
  routes.push({ method: "GET", prefix: ROUTES.events, exact: true, handle: (req, res) => handleEvents(req, res, options.events) });
```

3. Create `tests/http/events.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { get } from "node:http";
import { createHttpServer } from "../../src/server/http/server.ts";
import { createFakeStudio, MemoryEventHub } from "../../src/contracts/fakes.ts";
import type { HttpServer } from "../../src/contracts/ports.ts";

let server: HttpServer | null = null;
afterEach(async () => { await server?.close(); server = null; });

function readUntil(port: number, marker: string, onOpen: () => void): Promise<{ type: string | undefined; text: string }> {
  return new Promise((resolve, reject) => {
    const req = get({ host: "127.0.0.1", port, path: "/api/events", headers: { host: `127.0.0.1:${port}` } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        text += chunk;
        if (text.includes(": connected")) onOpen();
        if (text.includes(marker)) { req.destroy(); resolve({ type: res.headers["content-type"], text }); }
      });
    });
    req.on("error", (e) => { if (!String(e).includes("socket hang up")) reject(e); });
  });
}

describe("events route", () => {
  it("streams emitted events as server-sent events", async () => {
    const hub = new MemoryEventHub();
    server = createHttpServer({ studio: createFakeStudio(), events: hub, uiDir: null, mcp: null });
    const port = await server.listen(0);
    let sent = false;
    const got = await readUntil(port, "external-change", () => { if (!sent) { sent = true; hub.emit({ type: "external-change", files: ["a.css"] }); } });
    expect(got.type).toBe("text/event-stream");
    expect(got.text).toContain('data: {"type":"external-change","files":["a.css"]}\n\n');
  });
  it("closes cleanly with an open stream", async () => {
    const hub = new MemoryEventHub();
    server = createHttpServer({ studio: createFakeStudio(), events: hub, uiDir: null, mcp: null });
    const port = await server.listen(0);
    await readUntil(port, ": connected", () => {});
    await server.close();
    server = null;
    expect(true).toBe(true);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN an event is emitted while a client listens THE SYSTEM SHALL send `data: <json>` followed by a blank line. (test: "streams emitted events as server-sent events")
- WHEN the server closes with a stream open THE SYSTEM SHALL close without hanging. (test: "closes cleanly with an open stream")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T015`.
The last line must be `GATE PASS T015`. On `GATE FAIL T015 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/http/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T015` prints `GATE PASS T015`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T015: Stream studio events to the browser
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
