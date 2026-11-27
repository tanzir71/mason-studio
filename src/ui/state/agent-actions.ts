import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createAgentActions(ctx: StoreContext): Pick<StudioActions,
  "openAgentPrompt" | "closeAgentPrompt" | "askAgent" | "loadProposals" | "acceptProposal" | "rejectProposal" |
  "openSettings" | "closeSettings" | "saveSettings"> {
  const { client } = ctx;
  return {
    openAgentPrompt() {
      if (ctx.get().selection === null) { ctx.toast("info", "Select a layer first, then ask the agent about it.", false); return; }
      ctx.set({ agentPrompt: { open: true, busy: false } });
    },
    closeAgentPrompt() { ctx.set({ agentPrompt: { open: false, busy: false } }); },
    async askAgent(prompt) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      ctx.set({ agentPrompt: { open: true, busy: true } });
      try {
        const proposal = await client.askAgent({ page, path: selection, prompt, scope });
        ctx.set((s) => ({ proposals: [proposal, ...s.proposals.filter((p) => p.id !== proposal.id)], agentPrompt: { open: false, busy: false } }));
      } catch (error) {
        ctx.set({ agentPrompt: { open: true, busy: false } });
        ctx.toast("error", error instanceof Error ? error.message : String(error), false);
      }
    },
    loadProposals: () => ctx.run(async () => { ctx.set({ proposals: await client.proposals() }); }),
    async acceptProposal(id, includeBlocked) {
      const result = await ctx.write(() => client.acceptProposal(id, includeBlocked));
      if (result) ctx.set((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? { ...p, status: "accepted" as const } : p)) }));
    },
    rejectProposal: (id) => ctx.run(async () => {
      const proposal = await client.rejectProposal(id);
      ctx.set((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? proposal : p)) }));
    }),
    openSettings() {
      ctx.set({ settingsOpen: true });
      client.settings().then((settings) => ctx.set({ settings })).catch(() => {});
    },
    closeSettings() { ctx.set({ settingsOpen: false }); },
    saveSettings: (settings) => ctx.run(async () => {
      const saved = await client.saveSettings(settings);
      ctx.set({ settings: saved, settingsOpen: false });
      ctx.toast("success", "Settings saved", false);
    }),
  };
}
