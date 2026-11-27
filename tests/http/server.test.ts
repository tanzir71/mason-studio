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
