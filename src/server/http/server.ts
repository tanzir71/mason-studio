import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { HOST, ROUTES } from "../../contracts/http.ts";
import type { CreateHttpServer, HttpServer, HttpServerOptions } from "../../contracts/ports.ts";
import { handleRpc } from "./rpc.ts";
import { serveProjectFile, serveUi } from "./static.ts";
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
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export const createHttpServer: CreateHttpServer = (options: HttpServerOptions): HttpServer => {
  let port = 0;
  const sockets = new Set<Socket>();
  const routes: Route[] = [];
  routes.push({ method: "POST", prefix: ROUTES.rpc, exact: false, handle: async (req, res, url) => {
    const method = decodeURIComponent(url.pathname.slice(ROUTES.rpc.length));
    const text = await readBody(req);
    let body: unknown;
    try {
      body = text.trim() === "" ? {} : JSON.parse(text);
    } catch {
      sendJson(res, 400, { error: { code: "INVALID_INPUT", message: "Invalid input." } });
      return;
    }
    const reply = await handleRpc(options.studio, method, body);
    sendJson(res, reply.status, reply.body);
  } });
  routes.push({ method: "POST", prefix: ROUTES.mcp, exact: true, handle: async (req, res) => {
    if (!options.mcp) {
      sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Not found." } });
      return;
    }
    const text = await readBody(req);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const reply = await options.mcp(parsed);
    if (reply.body === null) {
      res.writeHead(202);
      res.end();
    } else {
      sendJson(res, reply.status, reply.body);
    }
  } });
  routes.push({ method: "GET", prefix: ROUTES.project, exact: false, handle: (_req, res, url) => serveProjectFile(options.studio, url.pathname.slice(ROUTES.project.length), res) });
  // @seam:routes
  let fallback: RouteHandler = (_req, res) => sendText(res, 404, "Not found");
  fallback = (_req, res, url) => serveUi(options.uiDir, url.pathname, res);
  // @seam:fallback

  const server = createServer((req, res) => {
    const host = req.headers.host;
    const allowed = host === `127.0.0.1:${port}` || host === `localhost:${port}`;
    if (!allowed) {
      sendText(res, 403, "Forbidden host");
      return;
    }
    const url = new URL(req.url ?? "/", `http://${HOST}:${port}`);
    const route = routes.find((r) => r.method === req.method && (r.exact ? url.pathname === r.prefix : url.pathname.startsWith(r.prefix)));
    const handler: RouteHandler = route?.handle ?? (req.method === "GET" ? fallback : (_r, res2) => sendText(res2, 404, "Not found"));
    Promise.resolve()
      .then(() => handler(req, res, url))
      .catch(() => {
        if (!res.headersSent) sendText(res, 500, "Internal error");
      });
  });
  server.on("connection", (socket: Socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  return {
    listen(requested: number) {
      return new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(requested, HOST, () => {
          port = (server.address() as AddressInfo).port;
          resolve(port);
        });
      });
    },
    close() {
      return new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      });
    },
  };
};
