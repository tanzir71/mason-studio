import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";

describe("settings group", () => {
  it("never returns the stored API key", async () => {
    const deps = createTestDeps();
    deps.settings.value = { settings: { ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, apiKey: "sk-secret" } }, recent: [] };
    const s = await createStudio(deps).settings();
    expect(s.agent.apiKey).toBe("");
    expect(s.hasApiKey).toBe(true);
  });
  it("keeps the stored key when the new key is empty and trims the URL", async () => {
    const deps = createTestDeps();
    const studio = createStudio(deps);
    await studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { baseUrl: "https://api.example.com/v1/", model: "m1", apiKey: "sk-1" } });
    const saved = await studio.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true, theme: "light", agent: { baseUrl: "https://api.example.com/v1", model: " m2 ", apiKey: "" } });
    expect(deps.settings.value!.settings.agent).toEqual({ baseUrl: "https://api.example.com/v1", model: "m2", apiKey: "sk-1" });
    expect(saved).toEqual({ agent: { baseUrl: "https://api.example.com/v1", model: "m2", apiKey: "" }, hasApiKey: true, mcpEnabled: true, theme: "light" });
  });
  it("rejects a bad URL or an empty model", async () => {
    const studio = createStudio(createTestDeps());
    await expect(studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, baseUrl: "ftp://x" } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(studio.saveSettings({ ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, model: " " } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
