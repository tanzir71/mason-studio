// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { AgentPrompt } from "../../src/ui/agent/AgentPrompt.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { InspectResult } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const state = { agentPrompt: { open: true, busy: false }, inspect: { name: "Headline" } as InspectResult, settings: DEFAULT_SETTINGS };

describe("AgentPrompt", () => {
  it("names the model and the layer and sends with Mod+Enter", async () => {
    const store = createFakeStore(state);
    render(<StudioContext.Provider value={store}><AgentPrompt /></StudioContext.Provider>);
    expect(screen.getByTestId("agent-prompt")).toHaveTextContent("Ask qwen2.5-coder:7b about Headline.");
    await userEvent.type(screen.getByLabelText("Request"), "Tighter on tablets{Control>}{Enter}{/Control}");
    expect(store.calls).toEqual([{ name: "askAgent", args: ["Tighter on tablets"] }]);
  });
  it("closes on Escape and disables Ask while empty or busy", async () => {
    const store = createFakeStore(state);
    render(<StudioContext.Provider value={store}><AgentPrompt /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Request"), "{Escape}");
    expect(store.calls).toEqual([{ name: "closeAgentPrompt", args: [] }]);
  });
  it("renders nothing while closed", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><AgentPrompt /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});
