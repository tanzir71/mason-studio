# T013: Implement the HTTP server core with RPC and MCP routes

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T013 (build), phase 2 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R9, R10 |

**Create:** `src/server/http/rpc.ts`, `tests/helpers/http.ts`, `tests/http/rpc.test.ts`, `tests/http/server.test.ts`

**Modify:** `src/server/http/server.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T013`):

1. `npx vitest run tests/http/rpc.test.ts tests/http/server.test.ts` -> exit 0, output contains `Tests  10 passed (10)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createHttpServer(options)` listens on 127.0.0.1, rejects foreign Host headers, and serves `/api/rpc/<method>` and `/mcp`.

## Context

HTTP module. Replaces the T002 stub. T014 adds static routes and T015 the events stream at the `@seam:routes` / `@seam:fallback` anchors this card creates (same module). The studio and MCP handler arrive through options; S003 and S006 compose them.

## Contracts (do not modify)

```ts
// src/contracts/http.ts
export const HOST = "127.0.0.1";
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
export const ERROR_STATUS: Record<MasonErrorCode, number> = {
  NOT_IMPLEMENTED: 501, NO_PROJECT: 409, NOT_A_PROJECT: 400, FOLDER_NOT_EMPTY: 409, PAGE_NOT_FOUND: 404,
  PAGE_EXISTS: 409, ELEMENT_NOT_FOUND: 404, NOT_TEXT_ELEMENT: 400, FILE_NOT_FOUND: 404, PATH_OUTSIDE_PROJECT: 403,
  CSS_PARSE_ERROR: 422, EDIT_CONFLICT: 409, NO_STYLESHEET: 400, NOTHING_TO_UNDO: 409, NOTHING_TO_REDO: 409,
  INVALID_INPUT: 400, TOKENS_INVALID: 422, PROPOSAL_NOT_FOUND: 404, PROPOSAL_CLOSED: 409, LLM_UNAVAILABLE: 502,
  LLM_BAD_RESPONSE: 502, GIT_FAILED: 500, MCP_DISABLED: 403, UNKNOWN_METHOD: 404,
};
```

```ts
// src/contracts/ports.ts
/** Handles one MCP HTTP POST body (JSON-RPC 2.0). `null` result means "no body, HTTP 202". */
export interface McpReply { status: number; body: unknown | null }
export type McpHandler = (body: unknown) => Promise<McpReply>;
export interface HttpServerOptions { studio: StudioService; events: EventHub; uiDir: string | null; mcp: McpHandler | null }
export interface HttpServer { listen(port: number): Promise<number>; close(): Promise<void> }
/** src/server/http/server.ts — binds 127.0.0.1 only; see contracts/http.ts for routes. */
export type CreateHttpServer = (options: HttpServerOptions) => HttpServer;
/** Every StudioService method name, in declaration order. RPC and MCP accept only these. */
export const STUDIO_METHODS = [
  "openProject", "createProject", "currentProject", "recentProjects", "templates", "createPage", "pageTree",
  "inspect", "applyStyle", "resetStyle", "insertElement", "editText", "removeElement", "moveElement", "wrapInStack",
  "undo", "redo", "readFile", "writeFile", "tokens", "importTokens", "exportTokens", "checks", "gitStatus", "commit",
  "proposals", "propose", "acceptProposal", "rejectProposal", "askAgent", "settings", "saveSettings",
] as const satisfies readonly (keyof StudioService)[];
```

```ts
// src/contracts/errors.ts
export function isMasonError(value: unknown): value is MasonError {
  return value instanceof Error && (value as { name?: string }).name === "MasonError" && "code" in value;
}
```

## Current state

`src/server/http/server.ts` is a stub that throws NOT_IMPLEMENTED. `src/server/http/rpc.ts` does not exist.

## Steps

1. Create `src/server/http/rpc.ts` exporting `handleRpc(studio: StudioService, method: string, body: unknown): Promise<{ status: number; body: unknown }>`:
   - `method` not in `STUDIO_METHODS` → `{ status: 404, body: { error: { code: "UNKNOWN_METHOD", message: new MasonError("UNKNOWN_METHOD", method).message } } }`.
   - `args` = `body.args` when body is an object whose `args` is an array, else `[]`.
   - `const result = await (studio[method] as (...a: unknown[]) => Promise<unknown>)(...args)` → `{ status: 200, body: { result: result ?? null } }`.
   - Catch: `isMasonError(e)` → `{ status: ERROR_STATUS[e.code], body: { error: { code: e.code, message: e.message } } }`; any other error → `{ status: 500, body: { error: { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) } } }`.

2. Replace the whole content of `src/server/http/server.ts` with this skeleton and complete every `// TODO` exactly as written (import `AddressInfo` as a type from `node:net`):
```ts
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { HOST, ROUTES } from "../../contracts/http.ts";
import type { CreateHttpServer, HttpServer, HttpServerOptions } from "../../contracts/ports.ts";
import { handleRpc } from "./rpc.ts";
// @seam:imports

export type RouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> | void;
export interface Route { method: string; prefix: string; exact: boolean; handle: RouteHandler }

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
export function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}
/** Reads the whole request body as UTF-8. */
export function readBody(req: IncomingMessage): Promise<string> {
  // TODO: collect "data" chunks and resolve on "end"; reject on "error".
}

export const createHttpServer: CreateHttpServer = (options: HttpServerOptions): HttpServer => {
  let port = 0;
  const sockets = new Set<Socket>();
  const routes: Route[] = [];
  routes.push({ method: "POST", prefix: ROUTES.rpc, exact: false, handle: async (req, res, url) => {
    // TODO: method = decodeURIComponent(url.pathname.slice(ROUTES.rpc.length)); text = await readBody(req);
    //       body = text.trim() === "" ? {} : JSON.parse(text) (a parse error → sendJson(res, 400, { error: { code: "INVALID_INPUT", message: "Invalid input." } }) and return);
    //       const reply = await handleRpc(options.studio, method, body); sendJson(res, reply.status, reply.body).
  } });
  routes.push({ method: "POST", prefix: ROUTES.mcp, exact: true, handle: async (req, res) => {
    // TODO: no options.mcp → sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Not found." } }).
    //       Parse the body as JSON; on failure sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }).
    //       const reply = await options.mcp(parsed); reply.body === null → res.writeHead(202); res.end();
    //       else sendJson(res, reply.status, reply.body).
  } });
  // @seam:routes
  let fallback: RouteHandler = (_req, res) => sendText(res, 404, "Not found");
  // @seam:fallback

  const server = createServer((req, res) => {
    // TODO: host = req.headers.host; allowed = `127.0.0.1:${port}` and `localhost:${port}`; else sendText(res, 403, "Forbidden host") and return.
    // TODO: url = new URL(req.url ?? "/", `http://${HOST}:${port}`); route = first r in routes with r.method === req.method and
    //       (r.exact ? url.pathname === r.prefix : url.pathname.startsWith(r.prefix)); handler = route?.handle ?? (req.method === "GET" ? fallback : 404 text "Not found").
    // TODO: run the handler; if it throws, and headers were not sent, sendText(res, 500, "Internal error").
  });
  server.on("connection", (socket: Socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  return {
    listen(requested: number) {
      // TODO: server.listen(requested, HOST); on "listening" set port = (server.address() as AddressInfo).port and resolve it; reject on "error".
    },
    close() {
      // TODO: destroy every socket in `sockets`, then server.close(() => resolve()).
    },
  };
};
```

3. Create `tests/helpers/http.ts` with exactly this content:

```ts
import { request } from "node:http";

/** Raw HTTP request to 127.0.0.1 with an explicit Host header. Resolves { status, headers, body }. */
export function rawRequest(port: number, method: string, path: string, options: { host?: string; body?: string } = {}):
  Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path, headers: { host: options.host ?? `127.0.0.1:${port}`, "content-type": "application/json" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
```

4. Create `tests/http/rpc.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { handleRpc } from "../../src/server/http/rpc.ts";
import { createFakeStudio } from "../../src/contracts/fakes.ts";
import { MasonError } from "../../src/contracts/errors.ts";

describe("handleRpc", () => {
  it("calls the studio method with the args and wraps the result", async () => {
    const studio = createFakeStudio({ pageTree: async (page) => ({ page } as never) });
    expect(await handleRpc(studio, "pageTree", { args: ["Home"] })).toEqual({ status: 200, body: { result: { page: "Home" } } });
  });
  it("answers 404 UNKNOWN_METHOD for names outside STUDIO_METHODS", async () => {
    const reply = await handleRpc(createFakeStudio(), "constructor", { args: [] });
    expect(reply).toEqual({ status: 404, body: { error: { code: "UNKNOWN_METHOD", message: "Unknown method. constructor" } } });
  });
  it("maps a MasonError to its HTTP status", async () => {
    const studio = createFakeStudio({ pageTree: async () => { throw new MasonError("PAGE_NOT_FOUND", "Nope"); } });
    expect(await handleRpc(studio, "pageTree", { args: ["Nope"] })).toEqual({ status: 404, body: { error: { code: "PAGE_NOT_FOUND", message: "Page not found. Nope" } } });
  });
  it("maps other errors to 500 INTERNAL and missing args to []", async () => {
    const seen: unknown[][] = [];
    const studio = createFakeStudio({
      templates: async (...a: unknown[]) => { seen.push(a); throw new Error("boom"); },
    });
    expect(await handleRpc(studio, "templates", {})).toEqual({ status: 500, body: { error: { code: "INTERNAL", message: "boom" } } });
    expect(seen).toEqual([[]]);
  });
  it("turns an undefined result into null", async () => {
    const studio = createFakeStudio({ templates: async () => undefined as never });
    expect(await handleRpc(studio, "templates", { args: [] })).toEqual({ status: 200, body: { result: null } });
  });
});
```

5. Create `tests/http/server.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createHttpServer } from "../../src/server/http/server.ts";
import { createFakeStudio, MemoryEventHub } from "../../src/contracts/fakes.ts";
import type { HttpServer, McpHandler } from "../../src/contracts/ports.ts";
import { rawRequest } from "../helpers/http.ts";

let server: HttpServer | null = null;
afterEach(async () => { await server?.close(); server = null; });
const start = async (mcp: McpHandler | null = null) => {
  server = createHttpServer({ studio: createFakeStudio({ templates: async () => [] }), events: new MemoryEventHub(), uiDir: null, mcp });
  return server.listen(0);
};

describe("createHttpServer", () => {
  it("listens on a free port and answers RPC calls", async () => {
    const port = await start();
    expect(port).toBeGreaterThan(0);
    const r = await rawRequest(port, "POST", "/api/rpc/templates", { body: '{"args":[]}' });
    expect([r.status, JSON.parse(r.body)]).toEqual([200, { result: [] }]);
  });
  it("rejects a foreign Host header with 403", async () => {
    const port = await start();
    const r = await rawRequest(port, "POST", "/api/rpc/templates", { host: "evil.example:80", body: "{}" });
    expect([r.status, r.body]).toEqual([403, "Forbidden host"]);
    expect((await rawRequest(port, "POST", "/api/rpc/templates", { host: `localhost:${port}`, body: "{}" })).status).toBe(200);
  });
  it("answers 400 for a body that is not JSON", async () => {
    const port = await start();
    expect((await rawRequest(port, "POST", "/api/rpc/templates", { body: "{nope" })).status).toBe(400);
  });
  it("answers 404 for /mcp without a handler and unknown paths", async () => {
    const port = await start();
    expect((await rawRequest(port, "POST", "/mcp", { body: "{}" })).status).toBe(404);
    expect((await rawRequest(port, "GET", "/nothing")).status).toBe(404);
  });
  it("passes /mcp bodies to the handler and answers 202 for an empty reply", async () => {
    const seen: unknown[] = [];
    const mcp: McpHandler = async (body) => { seen.push(body); return (body as { id?: number }).id ? { status: 200, body: { ok: true } } : { status: 202, body: null }; };
    const port = await start(mcp);
    const a = await rawRequest(port, "POST", "/mcp", { body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' });
    const b = await rawRequest(port, "POST", "/mcp", { body: '{"jsonrpc":"2.0","method":"notifications/initialized"}' });
    expect([a.status, JSON.parse(a.body), b.status, b.body]).toEqual([200, { ok: true }, 202, ""]);
    expect(seen.length).toBe(2);
  });
});
```

6. Run the gate (see Verify).

## Acceptance criteria

- WHEN POST /api/rpc/<method> is called THE SYSTEM SHALL call that studio method with body.args and answer { result }. (test: "listens on a free port and answers RPC calls")
- IF the method is not a StudioService method THEN THE SYSTEM SHALL answer 404 UNKNOWN_METHOD. (test: "answers 404 UNKNOWN_METHOD for names outside STUDIO_METHODS")
- IF the studio throws a MasonError THEN THE SYSTEM SHALL answer ERROR_STATUS[code] with { error: { code, message } }. (test: "maps a MasonError to its HTTP status")
- IF the Host header is not 127.0.0.1:<port> or localhost:<port> THEN THE SYSTEM SHALL answer 403 "Forbidden host". (test: "rejects a foreign Host header with 403")
- WHEN the MCP handler returns a null body THE SYSTEM SHALL answer 202 with no body. (test: "passes /mcp bodies to the handler and answers 202 for an empty reply")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T013`.
The last line must be `GATE PASS T013`. On `GATE FAIL T013 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/http/` and uses only the contracts (fakes only in tests).
- Do not bind to 0.0.0.0 or any host other than HOST.
- Do not call any studio method that is not in STUDIO_METHODS.

## Done when

- `verify.ps1 -Card T013` prints `GATE PASS T013`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T013: Implement the HTTP server core with RPC and MCP routes
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
