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
