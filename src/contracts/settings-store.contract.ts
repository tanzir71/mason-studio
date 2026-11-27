/** Shared SettingsStore contract suite. Planner-owned (protected): never edit. */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./model.ts";
import type { SettingsStore } from "./ports.ts";

export function runSettingsStoreContract(label: string, make: () => Promise<{ store: SettingsStore; cleanup(): Promise<void> }>): void {
  describe(`SettingsStore contract: ${label}`, () => {
    it("loads defaults when nothing is stored", async () => {
      const { store, cleanup } = await make();
      expect(await store.load()).toEqual({ settings: DEFAULT_SETTINGS, recent: [] });
      await cleanup();
    });
    it("saves and loads the same value", async () => {
      const { store, cleanup } = await make();
      const value = { settings: { ...DEFAULT_SETTINGS, mcpEnabled: true, agent: { baseUrl: "http://x/v1", model: "m", apiKey: "k" } }, recent: [{ root: "/p", name: "p", openedAt: 5 }] };
      await store.save(value);
      expect(await store.load()).toEqual(value);
      await cleanup();
    });
    it("does not share state through the returned object", async () => {
      const { store, cleanup } = await make();
      const loaded = await store.load();
      loaded.recent.push({ root: "/x", name: "x", openedAt: 1 });
      expect((await store.load()).recent).toEqual([]);
      await cleanup();
    });
  });
}
