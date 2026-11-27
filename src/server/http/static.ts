import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import type { ServerResponse } from "node:http";
import { MIME } from "../../contracts/http.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { sendText } from "./server.ts";

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapes(path: string): boolean {
  return path.split("/").some((segment) => segment === "..");
}

export async function serveProjectFile(studio: StudioService, rel: string, res: ServerResponse): Promise<void> {
  const decoded = decode(rel);
  if (escapes(decoded)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  let root: string;
  try {
    root = (await studio.currentProject()).root;
  } catch {
    sendText(res, 404, "Not found");
    return;
  }
  let data: Buffer;
  try {
    data = await readFile(join(root, decoded));
  } catch {
    sendText(res, 404, "Not found");
    return;
  }
  const type = MIME[extname(decoded).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(data);
}

export async function serveUi(uiDir: string | null, pathname: string, res: ServerResponse): Promise<void> {
  if (!uiDir) {
    sendText(res, 404, "Not found");
    return;
  }
  const decoded = decode(pathname);
  let rel = decoded.replace(/^\/+/, "");
  if (rel === "") rel = "index.html";
  if (escapes(rel)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  const file = join(uiDir, rel);
  let isFile = false;
  try {
    isFile = (await stat(file)).isFile();
  } catch {
    isFile = false;
  }
  const target = isFile ? file : join(uiDir, "index.html");
  try {
    const data = await readFile(target);
    const type = isFile ? (MIME[extname(target).toLowerCase()] ?? "application/octet-stream") : "text/html; charset=utf-8";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}
