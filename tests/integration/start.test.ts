import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import { rawRequest } from "../helpers/http.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function setup() {
  const base = mkdtempSync(join(tmpdir(), "mason-start-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  return { project: join(base, "north"), home: join(base, "home") };
}

describe("startMason", () => {
  it("starts on a free port and opens the given project", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    expect(running.url).toBe(`http://127.0.0.1:${running.port}/`);
    const r = await rawRequest(running.port, "POST", "/api/rpc/currentProject", { body: "{}" });
    expect(JSON.parse(r.body).result.pages.map((p: { name: string }) => p.name)).toEqual(["Home", "Menu"]);
  });
  it("serves project files through the real file system", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    const r = await rawRequest(running.port, "GET", "/p/styles.css");
    expect(r.body).toBe(readFileSync(join(project, "styles.css"), "utf8"));
  });
  it("stores recent projects in the home folder", async () => {
    const { project, home } = setup();
    running = await startMason({ port: 0, project, homeDir: home, uiDir: null });
    expect(existsSync(join(home, "settings.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(home, "settings.json"), "utf8")).recent[0].name).toBe("north");
  });
});
