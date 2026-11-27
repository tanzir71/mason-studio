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
