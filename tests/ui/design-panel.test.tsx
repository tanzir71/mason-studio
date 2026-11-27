// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DesignPanel } from "../../src/ui/panels/DesignPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { INSPECT_PROPS } from "../../src/contracts/model.ts";
import type { ElementNode, InspectResult, PropInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const empty: PropInfo = { values: { desktop: null, tablet: null, mobile: null }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: [] };
const props = Object.fromEntries(INSPECT_PROPS.map((p) => [p, empty])) as InspectResult["props"];
props["font-size"] = { values: { desktop: "40px", tablet: "32px", mobile: "28px" }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: ["tablet", "mobile"] };
props.color = { values: { desktop: "#1e2a22", tablet: "#1e2a22", mobile: "#1e2a22" }, winners: { desktop: null, tablet: null, mobile: null }, overriddenAt: [] };
const inspect: InspectResult = { page: "Home", path: "0.0", name: "Headline", tag: "h1", selector: ".headline", props, rules: { desktop: [], tablet: [], mobile: [] } };
const tree = { path: "", kind: "frame", children: [{ path: "0", kind: "stack", children: [{ path: "0.0", kind: "text", children: [] }] }] } as unknown as ElementNode;
const renderWith = (ui: React.ReactElement, state = {}) => {
  const store = createFakeStore({ screen: "canvas", page: "Home", selection: "0.0", inspect, tree, ...state });
  render(<StudioContext.Provider value={store}>{ui}</StudioContext.Provider>);
  return store;
};

describe("DesignPanel", () => {
  it("asks for a selection when nothing is selected", () => {
    renderWith(<DesignPanel />, { selection: null });
    expect(screen.getByTestId("design-panel")).toHaveTextContent("Select a layer to edit its style.");
  });
  it("shows the layer, the scope switch and the values at the scope", () => {
    renderWith(<DesignPanel />, { scope: "tablet" });
    const panel = screen.getByTestId("design-panel");
    expect(panel).toHaveTextContent("Headlineh1");
    expect(screen.getByTestId("scope-control")).toHaveTextContent("Tablet and smaller. Desktop keeps its own values.");
    expect(screen.getByLabelText("Font size")).toHaveValue("32px");
    expect(screen.getByLabelText("Font size").closest(".m-field")).toHaveClass("is-override");
    expect(within(screen.getByTestId("design-text")).getByText("Size set for ≤ 768. Desktop: 40px")).toBeInTheDocument();
  });
  it("applies an edited value and resets an override", async () => {
    const store = renderWith(<DesignPanel />, { scope: "tablet" });
    const size = screen.getByLabelText("Font size");
    await userEvent.clear(size);
    await userEvent.type(size, "30px{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(store.calls).toEqual([{ name: "applyStyle", args: ["font-size", "30px"] }, { name: "resetStyle", args: ["font-size"] }]);
  });
});
