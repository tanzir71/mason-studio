// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { LayersTree, dropIndex, parentPath } from "../../src/ui/panels/LayersTree.tsx";
import { parsePage } from "../../src/engine/html/parse.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;

describe("layer reordering", () => {
  it("computes parents and drop indexes for siblings only", () => {
    expect([parentPath("1.0.2"), parentPath("2")]).toEqual(["1.0", ""]);
    expect(dropIndex("0", "2")).toBe(2);
    expect(dropIndex("1.0.0.3", "1.0.0.0")).toBe(0);
    expect(dropIndex("1.0", "2")).toBeNull();
    expect(dropIndex("", "1")).toBeNull();
  });
  it("moves a dragged row to the drop target's index", () => {
    const store = createFakeStore({ screen: "canvas", page: "Home", tree });
    render(<StudioContext.Provider value={store}><LayersTree /></StudioContext.Provider>);
    const footer = screen.getByRole("treeitem", { name: "Footer" });
    const header = screen.getByRole("treeitem", { name: "Header" });
    expect(footer).toHaveAttribute("draggable", "true");
    expect(screen.getByRole("treeitem", { name: "Home" })).toHaveAttribute("draggable", "false");
    fireEvent.dragStart(footer);
    fireEvent.dragOver(header);
    fireEvent.drop(header);
    expect(store.calls).toEqual([{ name: "moveElement", args: ["2", 0] }]);
  });
});
