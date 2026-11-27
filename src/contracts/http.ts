/** HTTP surface of the local server. Planner-owned contract: never edit. */
import type { MasonErrorCode } from "./errors.ts";

export const DEFAULT_PORT = 39765;
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
/** MIME types for static files by extension; anything else → "application/octet-stream". */
export const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};
