// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { RightPanel } from "../../src/ui/panels/RightPanel.tsx";
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

describe("RightPanel", () => {
  it("switches between Design, Inspect and Checks", async () => {
    const store = renderWith(<RightPanel />);
    expect(screen.getByTestId("design-panel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Checks" }));
    expect(store.calls).toEqual([{ name: "setRightTab", args: ["checks"] }]);
  });
});
