import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectWatcher, suppressOwnWrites } from "../../src/server/infra/watcher.ts";
import { MemoryEventHub } from "../../src/contracts/fakes.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createProjectWatcher", () => {
  it("emits one debounced external-change with sorted files, ignoring .git", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-watch-"));
    mkdirSync(join(dir, "css"));
    mkdirSync(join(dir, ".git"));
    const hub = new MemoryEventHub();
    const watcher = createProjectWatcher(hub);
    watcher.watch(dir);
    await wait(100);
    writeFileSync(join(dir, "styles.css"), "a{}");
    writeFileSync(join(dir, "css", "b.css"), "b{}");
    writeFileSync(join(dir, ".git", "index"), "x");
    await wait(700);
    watcher.close();
    expect(hub.emitted).toEqual([{ type: "external-change", files: ["css/b.css", "styles.css"] }]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("stops after close", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-watch-"));
    const hub = new MemoryEventHub();
    const watcher = createProjectWatcher(hub);
    watcher.watch(dir);
    watcher.close();
    writeFileSync(join(dir, "a.css"), "a{}");
    await wait(400);
    expect(hub.emitted).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("suppressOwnWrites", () => {
  it("drops files Mason wrote within the window and passes the rest", () => {
    let t = 0;
    const hub = new MemoryEventHub();
    const sink = suppressOwnWrites(hub, 1000, () => t);
    hub.emit({ type: "written", files: ["styles.css"], revision: 1 });
    t = 500;
    sink.emit({ type: "external-change", files: ["styles.css"] });
    sink.emit({ type: "external-change", files: ["index.html", "styles.css"] });
    t = 2000;
    sink.emit({ type: "external-change", files: ["styles.css"] });
    const external = hub.emitted.filter((e: MasonEvent) => e.type === "external-change");
    expect(external).toEqual([{ type: "external-change", files: ["index.html"] }, { type: "external-change", files: ["styles.css"] }]);
  });
});
