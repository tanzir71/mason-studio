// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { SettingsDialog } from "../../src/ui/agent/SettingsDialog.tsx";
import { Workspace } from "../../src/ui/app/Workspace.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

describe("SettingsDialog", () => {
  it("edits agent, MCP and theme settings and saves them", async () => {
    const store = createFakeStore({ settingsOpen: true, settings: { ...DEFAULT_SETTINGS, hasApiKey: true } });
    render(<StudioContext.Provider value={store}><SettingsDialog /></StudioContext.Provider>);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toHaveAttribute("placeholder", "Saved. Type to replace it.");
    const model = screen.getByLabelText("Model");
    await userEvent.clear(model);
    await userEvent.type(model, "llama3.2");
    await userEvent.click(screen.getByLabelText("Let MCP agents read pages and propose changes"));
    await userEvent.click(screen.getByRole("tab", { name: "Light" }));
    expect(screen.getByTestId("settings-dialog")).toHaveTextContent("MCP endpoint: http://localhost:3000/mcp");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(store.calls).toEqual([{ name: "saveSettings", args: [{ ...DEFAULT_SETTINGS, hasApiKey: true, mcpEnabled: true, theme: "light", agent: { ...DEFAULT_SETTINGS.agent, model: "llama3.2" } }] }]);
  });
  it("cancels", async () => {
    const store = createFakeStore({ settingsOpen: true, settings: DEFAULT_SETTINGS });
    render(<StudioContext.Provider value={store}><SettingsDialog /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.calls).toEqual([{ name: "closeSettings", args: [] }]);
  });
  it("adds the review card, prompt and settings to the workspace", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", settingsOpen: true, agentPrompt: { open: true, busy: false } })}><Workspace /></StudioContext.Provider>);
    expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("agent-prompt")).toBeInTheDocument();
  });
});
