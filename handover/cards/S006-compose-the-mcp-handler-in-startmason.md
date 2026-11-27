# S006: Compose the MCP handler in startMason

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S006 (seam), phase 9 |
| Depends on | T076, T071, S003 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S006: mcp -> shell (compose): createMcpHandler |
| Requirements | R33 |

**Create:** `tests/integration/mcp.test.ts`

**Modify:** `src/server/start.ts`

**Read only:** `src/server/mcp/handler.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S006`):

1. `npx vitest run tests/integration/mcp.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`POST /mcp` reaches the real MCP handler, switched on and off by the `mcpEnabled` setting.

## Context

Seam mcp → shell (compose). The HTTP server already receives the `mcp` variable at `compose-server` (S003); this card assigns it above `compose-mcp`, which runs first.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/** src/server/mcp/handler.ts */
export type CreateMcpHandler = (studio: StudioService, options: { version: string; enabled(): Promise<boolean> }) => McpHandler;
```

## Touch list

### src/server/start.ts (modify)

Anchor: `// @seam:imports`. Insert directly above it:

```ts
import { createMcpHandler } from "./mcp/handler.ts";
```

Anchor: `  // @seam:compose-mcp`. Insert directly above it:

```ts
  mcp = createMcpHandler(studio, { version: MASON_VERSION, enabled: async () => (await settings.load()).settings.mcpEnabled });
```

Before:

```ts
  // @seam:compose-core
  // @seam:compose-mcp
  server = createHttpServer({ studio, events: hub, uiDir: existsSync(uiDir) ? uiDir : null, mcp });
```

After:

```ts
  // @seam:compose-core
  mcp = createMcpHandler(studio, { version: MASON_VERSION, enabled: async () => (await settings.load()).settings.mcpEnabled });
  // @seam:compose-mcp
  server = createHttpServer({ studio, events: hub, uiDir: existsSync(uiDir) ? uiDir : null, mcp });
```

## Steps

1. Apply both insertions of the touch list to `src/server/start.ts`.

2. Create `tests/integration/mcp.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import { rawRequest } from "../helpers/http.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function start() {
  const base = mkdtempSync(join(tmpdir(), "mason-mcp-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  running = await startMason({ port: 0, project: join(base, "north"), homeDir: join(base, "home"), uiDir: null });
  return running;
}
const post = (port: number, body: unknown) => rawRequest(port, "POST", "/mcp", { body: JSON.stringify(body) });

describe("MCP over HTTP", () => {
  it("is off until settings turn it on", async () => {
    const m = await start();
    expect((await post(m.port, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(403);
    await m.studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    const r = await post(m.port, { jsonrpc: "2.0", id: 1, method: "ping" });
    expect([r.status, JSON.parse(r.body)]).toEqual([200, { jsonrpc: "2.0", id: 1, result: {} }]);
  });
  it("lets an agent read pages and file a proposal", async () => {
    const m = await start();
    await m.studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    const r = await post(m.port, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "propose_style_changes", arguments: {
      page: "Home", summary: "Tablet headline", agent_name: "Claude Code", changes: [{ path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" }] } } });
    const result = JSON.parse(r.body).result;
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text).message).toMatch(/^Proposal .+ is waiting for review in Mason\. Nothing was written\.$/);
    expect((await m.studio.proposals())[0]).toMatchObject({ source: "Claude Code", status: "pending" });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHILE mcpEnabled is false THE SYSTEM SHALL answer /mcp with 403; after enabling it SHALL answer ping. (test: "is off until settings turn it on")
- WHEN an agent calls propose_style_changes over HTTP THE SYSTEM SHALL file a pending proposal and write nothing. (test: "lets an agent read pages and file a proposal")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S006`.
The last line must be `GATE PASS S006`. On `GATE FAIL S006 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S006 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S006` prints `GATE PASS S006`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S006: Compose the MCP handler in startMason
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
