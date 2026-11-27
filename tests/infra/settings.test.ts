import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileSettingsStore } from "../../src/server/infra/settings.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";

describe("createFileSettingsStore", () => {
  it("returns defaults when the file holds invalid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    writeFileSync(join(dir, "settings.json"), "{nope");
    expect(await createFileSettingsStore(join(dir, "settings.json")).load()).toEqual({ settings: DEFAULT_SETTINGS, recent: [] });
    rmSync(dir, { recursive: true, force: true });
  });
  it("fills missing fields from the defaults", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ settings: { mcpEnabled: true, agent: { model: "m" } } }));
    const loaded = await createFileSettingsStore(join(dir, "settings.json")).load();
    expect(loaded.settings.mcpEnabled).toBe(true);
    expect(loaded.settings.agent).toEqual({ ...DEFAULT_SETTINGS.agent, model: "m" });
    expect(loaded.recent).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("writes pretty JSON and creates the folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-set-"));
    const file = join(dir, "nested", "settings.json");
    await createFileSettingsStore(file).save({ settings: DEFAULT_SETTINGS, recent: [] });
    expect(readFileSync(file, "utf8")).toBe(JSON.stringify({ settings: DEFAULT_SETTINGS, recent: [] }, null, 2) + "\n");
    rmSync(dir, { recursive: true, force: true });
  });
});
