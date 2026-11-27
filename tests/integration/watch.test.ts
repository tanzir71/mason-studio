import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMason } from "../../src/server/start.ts";
import type { RunningMason } from "../../src/contracts/ports.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

let running: RunningMason | null = null;
const dirs: string[] = [];
afterEach(async () => { await running?.close(); running = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start() {
  const base = mkdtempSync(join(tmpdir(), "mason-watch-int-"));
  dirs.push(base);
  cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
  running = await startMason({ port: 0, project: join(base, "north"), homeDir: join(base, "home"), uiDir: null });
  return { m: running, root: join(base, "north") };
}

/** Collects events from the server's /api/events stream. */
async function listen(port: number): Promise<{ events: MasonEvent[]; stop(): void }> {
  const events: MasonEvent[] = [];
  const controller = new AbortController();
  const res = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value);
        let i;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          if (chunk.startsWith("data: ")) events.push(JSON.parse(chunk.slice(6)));
        }
      }
    } catch { /* aborted */ }
  })();
  return { events, stop: () => controller.abort() };
}

describe("project watcher in startMason", () => {
  it("reports files changed by other programs", async () => {
    const { m, root } = await start();
    const l = await listen(m.port);
    await wait(150);
    writeFileSync(join(root, "styles.css"), "body { margin: 0; }\n");
    await wait(800);
    l.stop();
    expect(l.events).toContainEqual({ type: "external-change", files: ["styles.css"] });
  });
  it("does not report Mason's own writes as external", async () => {
    const { m } = await start();
    const l = await listen(m.port);
    await wait(150);
    await m.studio.applyStyle({ page: "Home", path: "1.0.0.1", prop: "font-size", value: "44px", scope: "all" });
    await wait(800);
    l.stop();
    expect(l.events.map((e) => e.type)).toEqual(["written"]);
  });
});
