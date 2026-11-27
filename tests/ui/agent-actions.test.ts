import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { AskInput, ElementNode, Proposal } from "../../src/contracts/model.ts";

const proposal = (id: string, status: Proposal["status"] = "pending") => ({ id, status, changes: [] } as unknown as Proposal);

describe("agent actions", () => {
  it("opens the prompt only with a selection", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.openAgentPrompt();
    expect(store.getState().agentPrompt.open).toBe(false);
    expect(store.getState().toast).toMatchObject({ text: "Select a layer first, then ask the agent about it." });
    store.setState({ selection: "1" });
    store.actions.openAgentPrompt();
    expect(store.getState().agentPrompt).toEqual({ open: true, busy: false });
  });
  it("asks the agent and puts the proposal first", async () => {
    const asked: AskInput[] = [];
    const store = createStudioStore(createFakeClient({ askAgent: async (i) => { asked.push(i); return proposal("p2"); } }).client);
    store.setState({ page: "Home", selection: "1.0", scope: "tablet", proposals: [proposal("p1")], agentPrompt: { open: true, busy: false } });
    await store.actions.askAgent("Smaller");
    expect(asked).toEqual([{ page: "Home", path: "1.0", prompt: "Smaller", scope: "tablet" }]);
    expect(store.getState().proposals.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(store.getState().agentPrompt).toEqual({ open: false, busy: false });
  });
  it("keeps the prompt open with an error toast when the agent fails", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ page: "Home", selection: "1.0", agentPrompt: { open: true, busy: false } });
    await store.actions.askAgent("x");
    expect(store.getState().agentPrompt).toEqual({ open: true, busy: false });
    expect(store.getState().toast).toMatchObject({ tone: "error", text: "Not implemented yet. askAgent" });
  });
  it("accepts and rejects proposals", async () => {
    const { client } = createFakeClient({
      acceptProposal: async () => ({ files: ["styles.css"], revision: 4, effective: true, path: null, message: "Applied 1 change from Claude Code" }),
      rejectProposal: async (id) => proposal(id, "rejected"),
      pageTree: async () => ({ tag: "body" } as ElementNode),
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home", proposals: [proposal("a"), proposal("b")] });
    await store.actions.acceptProposal("a", false);
    await store.actions.rejectProposal("b");
    expect(store.getState().proposals.map((p) => [p.id, p.status])).toEqual([["a", "accepted"], ["b", "rejected"]]);
    expect(store.getState().revision).toBe(4);
  });
  it("opens, saves and closes settings", async () => {
    const { client } = createFakeClient({ settings: async () => DEFAULT_SETTINGS, saveSettings: async (s) => ({ ...s, hasApiKey: true }) });
    const store = createStudioStore(client);
    store.actions.openSettings();
    expect(store.getState().settingsOpen).toBe(true);
    await store.actions.saveSettings({ ...DEFAULT_SETTINGS, mcpEnabled: true });
    expect(store.getState()).toMatchObject({ settingsOpen: false, settings: { mcpEnabled: true, hasApiKey: true }, toast: { text: "Settings saved" } });
  });
});
