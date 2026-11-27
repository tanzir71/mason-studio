import { MasonError } from "../../contracts/errors.ts";
import type { Settings } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import type { EngineContext } from "./context.ts";

/** The stored agent settings including the real API key (engine-internal; never sent to the UI). */
export async function agentSettings(ctx: EngineContext): Promise<Settings["agent"]> {
  return (await ctx.deps.settings.load()).settings.agent;
}

export function createSettingsGroup(ctx: EngineContext): Pick<StudioService, "settings" | "saveSettings"> {
  const group: Pick<StudioService, "settings" | "saveSettings"> = {
    async settings() {
      const { settings } = await ctx.deps.settings.load();
      return { ...settings, agent: { ...settings.agent, apiKey: "" }, hasApiKey: settings.agent.apiKey !== "" };
    },
    async saveSettings(next) {
      const baseUrl = next.agent.baseUrl.trim().replace(/\/+$/, "");
      if (!/^https?:\/\/\S+$/.test(baseUrl)) throw new MasonError("INVALID_INPUT", "The agent URL must start with http:// or https://.");
      if (next.agent.model.trim() === "") throw new MasonError("INVALID_INPUT", "The model name is empty.");
      if (next.theme !== "dark" && next.theme !== "light") throw new MasonError("INVALID_INPUT", next.theme);
      const stored = await ctx.deps.settings.load();
      const apiKey = next.agent.apiKey === "" ? stored.settings.agent.apiKey : next.agent.apiKey;
      stored.settings = { agent: { baseUrl, model: next.agent.model.trim(), apiKey }, hasApiKey: apiKey !== "", mcpEnabled: next.mcpEnabled === true, theme: next.theme };
      await ctx.deps.settings.save(stored);
      return group.settings();
    },
  };
  return group;
}
