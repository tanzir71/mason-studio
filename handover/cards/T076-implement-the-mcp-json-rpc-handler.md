# T076: Implement the MCP JSON-RPC handler

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T076 (build), phase 9 |
| Depends on | T075 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R33 |

**Create:** `tests/mcp/handler.test.ts`

**Modify:** `src/server/mcp/handler.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T076`):

1. `npx vitest run tests/mcp/handler.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createMcpHandler(studio, options)` answers initialize, ping, tools/list and tools/call per the contract rules, refusing everything while MCP is off.

## Context

MCP module. Replaces the T002 stub. Stateless: every POST is answered on its own. The HTTP server (T013) already passes `/mcp` bodies to it; S006 creates it in `startMason`.

## Contracts (do not modify)

```ts
// src/contracts/mcp.ts
/** MCP surface (stateless JSON-RPC 2.0 over HTTP POST /mcp). Planner-owned contract: never edit. */
export const MCP_SERVER_NAME = "mason";
/** initialize echoes params.protocolVersion when it is in this list, else answers with the first entry. */
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const MCP_INSTRUCTIONS =
  "Mason edits plain HTML/CSS pages. Read with list_pages, get_page_structure and get_element. Style changes are " +
  "proposals: call propose_style_changes, then a person accepts or rejects them in Mason. Nothing is written until then.";
```

```ts
// src/contracts/ports.ts
/** Handles one MCP HTTP POST body (JSON-RPC 2.0). `null` result means "no body, HTTP 202". */
export interface McpReply { status: number; body: unknown | null }
export type McpHandler = (body: unknown) => Promise<McpReply>;
/** src/server/mcp/handler.ts */
export type CreateMcpHandler = (studio: StudioService, options: { version: string; enabled(): Promise<boolean> }) => McpHandler;
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
```

## Current state

`src/server/mcp/handler.ts` is a stub that throws NOT_IMPLEMENTED. `src/server/mcp/tools.ts` exports `runTool`.

## Steps

1. Replace the whole content of `src/server/mcp/handler.ts` with exactly:

```ts
import { ERROR_MESSAGES } from "../../contracts/errors.ts";
import { MCP_INSTRUCTIONS, MCP_PROTOCOL_VERSIONS, MCP_SERVER_NAME, MCP_TOOLS } from "../../contracts/mcp.ts";
import type { McpToolName } from "../../contracts/mcp.ts";
import type { CreateMcpHandler, McpReply } from "../../contracts/ports.ts";
import { runTool } from "./tools.ts";

type Id = string | number | null;
const reply = (id: Id, result: unknown): McpReply => ({ status: 200, body: { jsonrpc: "2.0", id, result } });
const fail = (status: number, id: Id, code: number, message: string): McpReply => ({ status, body: { jsonrpc: "2.0", id, error: { code, message } } });

/** Stateless MCP over HTTP POST (JSON-RPC 2.0). See the handler rules in src/contracts/mcp.ts. */
export const createMcpHandler: CreateMcpHandler = (studio, options) => async (body) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, null, -32600, "Invalid Request");
  const msg = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  const id: Id = typeof msg.id === "string" || typeof msg.id === "number" ? msg.id : null;
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(400, null, -32600, "Invalid Request");
  if (!(await options.enabled())) return fail(403, id, -32001, ERROR_MESSAGES.MCP_DISABLED);
  if (!("id" in msg)) return { status: 202, body: null };
  const params = (typeof msg.params === "object" && msg.params !== null ? msg.params : {}) as Record<string, unknown>;
  switch (msg.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly unknown[]).includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0];
      return reply(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: MCP_SERVER_NAME, version: options.version }, instructions: MCP_INSTRUCTIONS });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !MCP_TOOLS.some((t) => t.name === name)) return fail(200, id, -32602, `Unknown tool: ${String(name)}`);
      const args = (typeof params.arguments === "object" && params.arguments !== null ? params.arguments : {}) as Record<string, unknown>;
      try {
        const data = await runTool(studio, name as McpToolName, args);
        return reply(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false });
      } catch (error) {
        return reply(id, { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true });
      }
    }
    default:
      return fail(200, id, -32601, "Method not found");
  }
};
```

2. Create `tests/mcp/handler.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createMcpHandler } from "../../src/server/mcp/handler.ts";
import { createFakeStudio } from "../../src/contracts/fakes.ts";
import { MCP_TOOLS } from "../../src/contracts/mcp.ts";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";

const project = { root: "/p", name: "p", pages: [{ name: "Home", file: "index.html", title: "T", stylesheets: [] }], breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false } as ProjectInfo;
const make = (enabled = true) => createMcpHandler(createFakeStudio({ currentProject: async () => project }), { version: "0.1.0", enabled: async () => enabled });
const call = (method: string, params?: unknown, id: number | null = 1) => ({ jsonrpc: "2.0", ...(id === null ? {} : { id }), method, ...(params ? { params } : {}) });

describe("MCP handler", () => {
  it("initializes with a supported protocol version", async () => {
    const r = await make()(call("initialize", { protocolVersion: "2025-06-18" }));
    expect(r).toEqual({ status: 200, body: { jsonrpc: "2.0", id: 1, result: {
      protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "mason", version: "0.1.0" },
      instructions: expect.stringContaining("Style changes are proposals"),
    } } });
    const other = await make()(call("initialize", { protocolVersion: "1999-01-01" }));
    expect((other.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe("2025-11-25");
  });
  it("answers notifications with 202 and ping with {}", async () => {
    expect(await make()(call("notifications/initialized", undefined, null))).toEqual({ status: 202, body: null });
    expect(await make()(call("ping"))).toEqual({ status: 200, body: { jsonrpc: "2.0", id: 1, result: {} } });
  });
  it("lists tools and calls one", async () => {
    const list = await make()(call("tools/list"));
    expect((list.body as { result: { tools: unknown[] } }).result.tools.length).toBe(MCP_TOOLS.length);
    const r = await make()(call("tools/call", { name: "list_pages", arguments: {} }));
    expect(r.body).toEqual({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify([{ name: "Home", file: "index.html", title: "T" }], null, 2) }], isError: false } });
  });
  it("reports tool errors as isError content", async () => {
    const r = await make()(call("tools/call", { name: "list_tokens", arguments: {} }));
    expect(r.body).toEqual({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "Not implemented yet. tokens" }], isError: true } });
  });
  it("rejects bad requests, unknown tools and methods, and a disabled server", async () => {
    expect(await make()([call("ping")])).toEqual({ status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } } });
    expect((await make()(call("tools/call", { name: "nope" }))).body).toEqual({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Unknown tool: nope" } });
    expect((await make()(call("resources/list"))).body).toEqual({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } });
    expect(await make(false)(call("ping", undefined, 7))).toEqual({ status: 403, body: { jsonrpc: "2.0", id: 7, error: { code: -32001, message: "MCP is off. Turn it on in Mason settings." } } });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN initialize asks for a supported protocol version THE SYSTEM SHALL echo it, else answer the newest. (test: "initializes with a supported protocol version")
- WHEN a notification arrives THE SYSTEM SHALL answer 202 without a body. (test: "answers notifications with 202 and ping with {}")
- IF MCP is off THEN THE SYSTEM SHALL answer 403 with code -32001. (test: "rejects bad requests, unknown tools and methods, and a disabled server")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T076`.
The last line must be `GATE PASS T076`. On `GATE FAIL T076 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/mcp/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T076` prints `GATE PASS T076`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T076: Implement the MCP JSON-RPC handler
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
