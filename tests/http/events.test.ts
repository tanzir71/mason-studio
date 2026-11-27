import { afterEach, describe, expect, it } from "vitest";
import { get } from "node:http";
import { createHttpServer } from "../../src/server/http/server.ts";
import { createFakeStudio, MemoryEventHub } from "../../src/contracts/fakes.ts";
import type { HttpServer } from "../../src/contracts/ports.ts";

let server: HttpServer | null = null;
afterEach(async () => { await server?.close(); server = null; });

function readUntil(port: number, marker: string, onOpen: () => void): Promise<{ type: string | undefined; text: string }> {
  return new Promise((resolve, reject) => {
    const req = get({ host: "127.0.0.1", port, path: "/api/events", headers: { host: `127.0.0.1:${port}` } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        text += chunk;
        if (text.includes(": connected")) onOpen();
        if (text.includes(marker)) { req.destroy(); resolve({ type: res.headers["content-type"], text }); }
      });
    });
    req.on("error", (e) => { if (!String(e).includes("socket hang up")) reject(e); });
  });
}

describe("events route", () => {
  it("streams emitted events as server-sent events", async () => {
    const hub = new MemoryEventHub();
    server = createHttpServer({ studio: createFakeStudio(), events: hub, uiDir: null, mcp: null });
    const port = await server.listen(0);
    let sent = false;
    const got = await readUntil(port, "external-change", () => { if (!sent) { sent = true; hub.emit({ type: "external-change", files: ["a.css"] }); } });
    expect(got.type).toBe("text/event-stream");
    expect(got.text).toContain('data: {"type":"external-change","files":["a.css"]}\n\n');
  });
  it("closes cleanly with an open stream", async () => {
    const hub = new MemoryEventHub();
    server = createHttpServer({ studio: createFakeStudio(), events: hub, uiDir: null, mcp: null });
    const port = await server.listen(0);
    await readUntil(port, ": connected", () => {});
    await server.close();
    server = null;
    expect(true).toBe(true);
  });
});
