# T018: Implement the browser HTTP client

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T018 (build), phase 3 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R14 |

**Create:** `tests/ui/http-client.test.ts`

**Modify:** `src/ui/api/http-client.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T018`):

1. `npx vitest run tests/ui/http-client.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createHttpClient(baseUrl)` turns every StudioService method into a POST to `/api/rpc/<method>` and streams `/api/events` to subscribers.

## Context

UI API module. Replaces the T002 stub. The store (T019) only ever talks to this `MasonClient`. Errors must keep the server's exact message because the store shows it in a toast.

## Contracts (do not modify)

```tsx
// src/contracts/ui.tsx
/** StudioService over HTTP plus the /api/events stream. */
export type MasonClient = StudioService & { subscribe(listener: (event: MasonEvent) => void): () => void };
/** src/ui/api/http-client.ts */
export type CreateHttpClient = (baseUrl: string) => MasonClient;
```

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
export const ERROR_MESSAGES: Record<MasonErrorCode, string> = {
  NOT_IMPLEMENTED: "Not implemented yet.",
  NO_PROJECT: "No project is open.",
  NOT_A_PROJECT: "That folder has no .html files.",
  FOLDER_NOT_EMPTY: "That folder is not empty.",
  PAGE_NOT_FOUND: "Page not found.",
  PAGE_EXISTS: "A page with that name already exists.",
  ELEMENT_NOT_FOUND: "Element not found.",
  NOT_TEXT_ELEMENT: "Only text elements can be edited as text.",
  FILE_NOT_FOUND: "File not found.",
  PATH_OUTSIDE_PROJECT: "Path is outside the project folder.",
  CSS_PARSE_ERROR: "The stylesheet could not be parsed.",
  EDIT_CONFLICT: "Two edits overlap.",
  NO_STYLESHEET: "This page has no local stylesheet.",
  NOTHING_TO_UNDO: "Nothing to undo.",
  NOTHING_TO_REDO: "Nothing to redo.",
  INVALID_INPUT: "Invalid input.",
  TOKENS_INVALID: "The tokens file could not be read.",
  PROPOSAL_NOT_FOUND: "Proposal not found.",
  PROPOSAL_CLOSED: "This proposal was already accepted or rejected.",
  LLM_UNAVAILABLE: "The agent endpoint did not respond.",
  LLM_BAD_RESPONSE: "The agent reply was not valid JSON.",
  GIT_FAILED: "Git command failed.",
  MCP_DISABLED: "MCP is off. Turn it on in Mason settings.",
  UNKNOWN_METHOD: "Unknown method.",
};
/** message = ERROR_MESSAGES[code], or `${ERROR_MESSAGES[code]} ${detail}` when detail is given. */
export class MasonError extends Error {
  readonly code: MasonErrorCode;
  readonly detail: string | null;
  constructor(code: MasonErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code]);
    this.name = "MasonError";
    this.code = code;
    this.detail = detail ?? null;
  }
}
```

## Current state

`src/ui/api/http-client.ts` is a stub that throws `new MasonError("NOT_IMPLEMENTED", "createHttpClient")`.

## Steps

1. Replace the whole content of `src/ui/api/http-client.ts` with exactly:

```ts
import { ERROR_MESSAGES, MasonError } from "../../contracts/errors.ts";
import type { MasonErrorCode } from "../../contracts/errors.ts";
import { ROUTES } from "../../contracts/http.ts";
import type { MasonEvent } from "../../contracts/model.ts";
import { STUDIO_METHODS } from "../../contracts/ports.ts";
import type { CreateHttpClient, MasonClient } from "../../contracts/ui.tsx";

/** Turns an RPC `error` body into a MasonError (known code) or an Error, keeping the server's message. */
export function toClientError(error: { code?: string; message?: string } | undefined, status: number): Error {
  const message = error?.message ?? `Request failed (${status}).`;
  if (error?.code && error.code in ERROR_MESSAGES) {
    const e = new MasonError(error.code as MasonErrorCode);
    e.message = message;
    return e;
  }
  return new Error(message);
}

export const createHttpClient: CreateHttpClient = (baseUrl: string): MasonClient => {
  const call = async (method: string, args: unknown[]): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${ROUTES.rpc}${method}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }),
      });
    } catch {
      throw new Error("Could not reach Mason. Is it still running?");
    }
    let body: { result?: unknown; error?: { code?: string; message?: string } };
    try { body = await res.json(); } catch { throw new Error(`Request failed (${res.status}).`); }
    if (res.ok) return body.result;
    throw toClientError(body.error, res.status);
  };
  const client: Record<string, unknown> = {};
  for (const m of STUDIO_METHODS) client[m] = (...args: unknown[]) => call(m, args);

  const listeners = new Set<(e: MasonEvent) => void>();
  let source: EventSource | null = null;
  client.subscribe = (listener: (e: MasonEvent) => void) => {
    listeners.add(listener);
    if (!source) {
      source = new EventSource(`${baseUrl}${ROUTES.events}`);
      source.onmessage = (m: MessageEvent<string>) => {
        let event: MasonEvent;
        try { event = JSON.parse(m.data) as MasonEvent; } catch { return; }
        for (const l of [...listeners]) l(event);
      };
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && source) { source.close(); source = null; }
    };
  };
  return client as unknown as MasonClient;
};
```

2. Create `tests/ui/http-client.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../../src/ui/api/http-client.ts";
import { isMasonError } from "../../src/contracts/errors.ts";

class FakeEventSource {
  static last: FakeEventSource | null = null;
  url: string; closed = false;
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor(url: string) { this.url = url; FakeEventSource.last = this; }
  close() { this.closed = true; }
}
afterEach(() => { vi.unstubAllGlobals(); FakeEventSource.last = null; });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createHttpClient", () => {
  it("posts args to the RPC route and returns the result", async () => {
    const fetchMock = vi.fn(async () => json(200, { result: { tag: "body" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("http://x");
    expect(await client.pageTree("Home")).toEqual({ tag: "body" });
    expect(fetchMock).toHaveBeenCalledWith("http://x/api/rpc/pageTree", { method: "POST", headers: { "content-type": "application/json" }, body: '{"args":["Home"]}' });
  });
  it("turns error bodies into MasonErrors with the server message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { error: { code: "PAGE_NOT_FOUND", message: "Page not found. Nope" } })));
    const error = await createHttpClient("").pageTree("Nope").catch((e: unknown) => e);
    expect(isMasonError(error)).toBe(true);
    expect(error).toMatchObject({ code: "PAGE_NOT_FOUND", message: "Page not found. Nope" });
  });
  it("uses a plain Error for unknown codes and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(500, { error: { code: "INTERNAL", message: "boom" } })));
    await expect(createHttpClient("").templates()).rejects.toThrow("boom");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(createHttpClient("").templates()).rejects.toThrow("Could not reach Mason. Is it still running?");
  });
  it("shares one event stream and closes it after the last listener leaves", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const client = createHttpClient("http://x");
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = client.subscribe((e) => a.push(e));
    const offB = client.subscribe((e) => b.push(e));
    const source = FakeEventSource.last!;
    expect(source.url).toBe("http://x/api/events");
    source.onmessage!({ data: '{"type":"external-change","files":["a.css"]}' });
    source.onmessage!({ data: "not json" });
    expect(a).toEqual([{ type: "external-change", files: ["a.css"] }]);
    expect(b.length).toBe(1);
    offA();
    expect(source.closed).toBe(false);
    offB();
    expect(source.closed).toBe(true);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN a method is called THE SYSTEM SHALL POST `{ args }` to `/api/rpc/<method>` and resolve to `result`. (test: "posts args to the RPC route and returns the result")
- IF the server answers an error with a known code THEN THE SYSTEM SHALL reject with a MasonError carrying the server message. (test: "turns error bodies into MasonErrors with the server message")
- THE SYSTEM SHALL share one EventSource across subscribers and close it after the last unsubscribe. (test: "shares one event stream and closes it after the last listener leaves")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T018`.
The last line must be `GATE PASS T018`. On `GATE FAIL T018 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/api/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T018` prints `GATE PASS T018`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T018: Implement the browser HTTP client
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
