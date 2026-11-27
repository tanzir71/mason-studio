// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ScopeControl } from "../../src/ui/panels/ScopeControl.tsx";
import { DESIGN_FIELDS, fieldView, nodeAt, sectionsFor } from "../../src/ui/panels/design-fields.ts";
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

describe("design fields", () => {
  it("covers every inspect property once", () => {
    expect(DESIGN_FIELDS.map((f) => f.prop).sort()).toEqual([...INSPECT_PROPS].sort());
  });
  it("shows text sections only for text and links", () => {
    expect(sectionsFor("text")).toContain("text");
    expect(sectionsFor("frame")).not.toContain("text");
  });
  it("reads the value at the scope breakpoint", () => {
    expect(fieldView(inspect, "font-size", "tablet")).toEqual({ value: "32px", override: true, desktop: "40px" });
    expect(fieldView(inspect, "font-size", "all")).toEqual({ value: "40px", override: false, desktop: "40px" });
    expect(fieldView(inspect, "padding", "all").value).toBe("");
    expect(nodeAt(tree, "0.0")!.kind).toBe("text");
    expect(nodeAt(tree, "3")).toBeNull();
  });
  it("changes the scope from the switch", async () => {
    const store = renderWith(<ScopeControl />);
    await userEvent.click(screen.getByRole("tab", { name: "≤ 375" }));
    expect(store.calls).toEqual([{ name: "setScope", args: ["mobile"] }]);
  });
});
