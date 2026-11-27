// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { InspectPanel } from "../../src/ui/panels/InspectPanel.tsx";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function inspectHeadline() {
  const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await studio.openProject("/p");
  return studio.inspect("Home", "1.0.0.1");
}

describe("InspectPanel", () => {
  it("lists the rules at the active breakpoint with overridden declarations struck", async () => {
    const inspect = await inspectHeadline();
    const store = createFakeStore({ screen: "canvas", page: "Home", selection: "1.0.0.1", inspect, activeBoard: "tablet" });
    render(<StudioContext.Provider value={store}><InspectPanel /></StudioContext.Provider>);
    const panel = screen.getByTestId("inspect-panel");
    expect(panel).toHaveTextContent(".headline");
    expect(panel).toHaveTextContent("Rules at Tablet 768px");
    const media = panel.querySelector('[data-rule="styles.css:58"]')!;
    expect(media).toHaveTextContent("@media (max-width: 768px)");
    expect(within(media as HTMLElement).getByText("font-size").closest("li")).toHaveAttribute("data-status", "winning");
    const base = panel.querySelector('[data-rule="styles.css:22"]')!;
    const baseSize = within(base as HTMLElement).getByText("font-size").closest("li")!;
    expect(baseSize).toHaveClass("is-overridden");
    expect(panel.querySelector('[data-rule="styles.css:64"]')).toHaveClass("is-inactive");
  });
  it("opens the code drawer at a rule's line", async () => {
    const inspect = await inspectHeadline();
    const store = createFakeStore({ screen: "canvas", page: "Home", selection: "1.0.0.1", inspect });
    render(<StudioContext.Provider value={store}><InspectPanel /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "styles.css:22" }));
    expect(store.calls).toEqual([{ name: "openCode", args: ["styles.css", 22] }]);
  });
  it("asks for a selection", () => {
    render(<StudioContext.Provider value={createFakeStore({ selection: null })}><InspectPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("inspect-panel")).toHaveTextContent("Select a layer to see its CSS.");
  });
  it("is the Inspect tab of the right panel", () => {
    render(<StudioContext.Provider value={createFakeStore({ rightTab: "inspect", selection: null })}><RightPanel /></StudioContext.Provider>);
    expect(screen.getByTestId("inspect-panel")).toBeInTheDocument();
  });
});
