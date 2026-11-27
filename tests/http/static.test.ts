import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "../../src/server/http/server.ts";
import { createFakeStudio, MemoryEventHub } from "../../src/contracts/fakes.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import type { HttpServer } from "../../src/contracts/ports.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { rawRequest } from "../helpers/http.ts";

let server: HttpServer | null = null;
const dirs: string[] = [];
afterEach(async () => { await server?.close(); server = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "mason-static-")); dirs.push(d); return d; };

async function start(projectRoot: string | null, uiDir: string | null) {
  const studio = createFakeStudio({
    currentProject: async () => { if (!projectRoot) throw new MasonError("NO_PROJECT"); return { root: projectRoot } as ProjectInfo; },
  });
  server = createHttpServer({ studio, events: new MemoryEventHub(), uiDir, mcp: null });
  return server.listen(0);
}

describe("static routes", () => {
  it("serves project files with their MIME type and no-store caching", async () => {
    const root = tmp();
    mkdirSync(join(root, "css"));
    writeFileSync(join(root, "css", "a.css"), "a{}");
    const port = await start(root, null);
    const r = await rawRequest(port, "GET", "/p/css/a.css");
    expect([r.status, r.body, r.headers["content-type"], r.headers["cache-control"]]).toEqual([200, "a{}", "text/css; charset=utf-8", "no-store"]);
  });
  it("answers 404 for missing project files and when no project is open", async () => {
    const port = await start(tmp(), null);
    expect((await rawRequest(port, "GET", "/p/missing.html")).status).toBe(404);
    await server!.close();
    const port2 = await start(null, null);
    expect((await rawRequest(port2, "GET", "/p/index.html")).status).toBe(404);
  });
  it("refuses project paths that escape the folder", async () => {
    const port = await start(tmp(), null);
    expect((await rawRequest(port, "GET", "/p/..%2fsecret.txt")).status).toBe(403);
  });
  it("serves UI files and falls back to index.html", async () => {
    const ui = tmp();
    mkdirSync(join(ui, "assets"));
    writeFileSync(join(ui, "index.html"), "<p>ui</p>");
    writeFileSync(join(ui, "assets", "app.js"), "1;");
    const port = await start(null, ui);
    expect((await rawRequest(port, "GET", "/assets/app.js")).headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect((await rawRequest(port, "GET", "/")).body).toBe("<p>ui</p>");
    expect((await rawRequest(port, "GET", "/some/route")).body).toBe("<p>ui</p>");
  });
  it("answers 404 for UI requests without a UI folder", async () => {
    const port = await start(null, null);
    expect((await rawRequest(port, "GET", "/")).status).toBe(404);
  });
});
