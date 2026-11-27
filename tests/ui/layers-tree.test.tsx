// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { LayersTree, defaultOpen } from "../../src/ui/panels/LayersTree.tsx";
import { parsePage } from "../../src/engine/html/parse.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;
const renderTree = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", page: "Home", tree, ...state });
  render(<StudioContext.Provider value={store}><LayersTree /></StudioContext.Provider>);
  return store;
};
const names = () => within(screen.getByTestId("layers-tree")).getAllByRole("treeitem").map((r) => r.textContent);

describe("LayersTree", () => {
  it("opens the body and the ancestors of the selection", () => {
    expect([...defaultOpen("1.0.0.1")]).toEqual(["", "1", "1.0", "1.0.0"]);
    expect([...defaultOpen(null)]).toEqual([""]);
  });
  it("lists the page and its top-level layers", () => {
    renderTree();
    expect(names()).toEqual(["Home", "Header", "Main", "Footer"]);
  });
  it("expands down to the selection and marks it", () => {
    renderTree({ selection: "1.0.0.1" });
    expect(names()).toEqual(["Home", "Header", "Main", "Hero", "Hero copy", "Eyebrow", "Headline", "Lede", "Order button", "Hero photo", "This week", "Footer"]);
    expect(screen.getByRole("treeitem", { name: /Headline/ })).toHaveAttribute("aria-selected", "true");
  });
  it("selects, hovers and toggles rows", async () => {
    const store = renderTree();
    await userEvent.click(screen.getByRole("treeitem", { name: /Footer/ }));
    const header = screen.getByRole("treeitem", { name: /Header/ });
    await userEvent.click(within(header).getByRole("button", { name: "Expand" }));
    expect(names()).toEqual(["Home", "Header", "Logo", "Nav", "Main", "Footer"]);
    expect(store.calls.filter((c) => c.name === "select")).toEqual([{ name: "select", args: ["2"] }]);
    expect(store.calls.some((c) => c.name === "hover" && c.args[0] === "2")).toBe(true);
  });
});
