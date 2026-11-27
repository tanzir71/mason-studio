import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import { rawRequest } from "../helpers/http.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function start() {
  const base = mkdtempSync(join(tmpdir(), "mason-mcp-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  running = await startMason({ port: 0, project: join(base, "north"), homeDir: join(base, "home"), uiDir: null });
  return running;
}
const post = (port: number, body: unknown) => rawRequest(port, "POST", "/mcp", { body: JSON.stringify(body) });

describe("MCP over HTTP", () => {
  it("is off until settings turn it on", async () => {
    const m = await start();
    expect((await post(m.port, { jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(403);
    await m.studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    const r = await post(m.port, { jsonrpc: "2.0", id: 1, method: "ping" });
    expect([r.status, JSON.parse(r.body)]).toEqual([200, { jsonrpc: "2.0", id: 1, result: {} }]);
  });
  it("lets an agent read pages and file a proposal", async () => {
    const m = await start();
    await m.studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    const r = await post(m.port, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "propose_style_changes", arguments: {
      page: "Home", summary: "Tablet headline", agent_name: "Claude Code", changes: [{ path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" }] } } });
    const result = JSON.parse(r.body).result;
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text).message).toMatch(/^Proposal .+ is waiting for review in Mason\. Nothing was written\.$/);
    expect((await m.studio.proposals())[0]).toMatchObject({ source: "Claude Code", status: "pending" });
  });
});
