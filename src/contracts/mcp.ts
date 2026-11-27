/** MCP surface (stateless JSON-RPC 2.0 over HTTP POST /mcp). Planner-owned contract: never edit. */
export const MCP_SERVER_NAME = "mason";
/** initialize echoes params.protocolVersion when it is in this list, else answers with the first entry. */
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const MCP_INSTRUCTIONS =
  "Mason edits plain HTML/CSS pages. Read with list_pages, get_page_structure and get_element. Style changes are " +
  "proposals: call propose_style_changes, then a person accepts or rejects them in Mason. Nothing is written until then.";
/**
 * Handler rules (createMcpHandler):
 * - Body must be one object with jsonrpc "2.0" and a string method, else 400 with error -32600 "Invalid Request" (id null). Arrays → same 400.
 * - enabled() false → 403 with error -32001 and message ERROR_MESSAGES.MCP_DISABLED (id echoed or null).
 * - No "id" (notification) → { status: 202, body: null }.
 * - "initialize" → { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "mason", version }, instructions: MCP_INSTRUCTIONS }.
 * - "ping" → {}. "tools/list" → { tools: MCP_TOOLS } (name, description, inputSchema only).
 * - "tools/call" { name, arguments } → unknown name: error -32602 `Unknown tool: ${name}`; success:
 *   { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false }; a thrown error:
 *   { content: [{ type: "text", text: error.message }], isError: true }.
 * - Any other method → error -32601 "Method not found". All replies except the 400/403 cases use status 200.
 * - Reply envelope: { jsonrpc: "2.0", id, result } or { jsonrpc: "2.0", id, error: { code, message } }.
 */
export interface McpToolDef { name: McpToolName; description: string; inputSchema: Record<string, unknown> }
export type McpToolName = "list_pages" | "get_page_structure" | "get_element" | "propose_style_changes" | "get_proposal" | "list_tokens" | "check_page";
const page = { type: "string", description: "Page name from list_pages, e.g. \"Home\"" };
const path = { type: "string", description: "Element path from get_page_structure, e.g. \"1.0.1\"" };
export const MCP_TOOLS: readonly McpToolDef[] = [
  { name: "list_pages", description: "List the pages of the open project. data: [{ name, file, title }]",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_page_structure", description: "Element tree of a page without script/style/meta elements. data: { path, tag, name, kind, children }",
    inputSchema: { type: "object", properties: { page }, required: ["page"], additionalProperties: false } },
  { name: "get_element", description: "Selector and declared style values of one element at Desktop, Tablet and Mobile. data: { name, tag, selector, values: { [prop]: { desktop, tablet, mobile } } } (only props with a value)",
    inputSchema: { type: "object", properties: { page, path }, required: ["page", "path"], additionalProperties: false } },
  { name: "propose_style_changes", description: "Propose style changes for review. Nothing is written until a person accepts. scope: all | tablet | mobile. data: { proposal_id, blocked, message }",
    inputSchema: { type: "object", required: ["page", "summary", "changes"], additionalProperties: false, properties: {
      page, summary: { type: "string" }, agent_name: { type: "string", description: "Your name, shown on the review card" },
      changes: { type: "array", minItems: 1, items: { type: "object", required: ["path", "prop", "value", "scope"], additionalProperties: false,
        properties: { path, prop: { type: "string" }, value: { type: "string" }, scope: { type: "string", enum: ["all", "tablet", "mobile"] } } } } } } },
  { name: "get_proposal", description: "Status of a proposal. data: { id, status, changes: [{ label, value, blocked }] }",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "list_tokens", description: "Design tokens of the project. data: [{ name, type, value }]",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "check_page", description: "Run taste, accessibility and token checks for a page. data: [{ severity, title, detail }]",
    inputSchema: { type: "object", properties: { page }, required: ["page"], additionalProperties: false } },
];
/** propose_style_changes data.message: */
export const MCP_PROPOSAL_MESSAGE = "Proposal {id} is waiting for review in Mason. Nothing was written.";
