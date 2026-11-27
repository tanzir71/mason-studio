// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardPointerDown, editablePath, insertTarget } from "../../src/ui/canvas/tools.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const tree = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8")).body;

describe("insert tools", () => {
  it("inserts inside containers and after other elements", () => {
    expect(insertTarget(tree, "1.0.0")).toEqual({ parentPath: "1.0.0", index: 4 });
    expect(insertTarget(tree, "1.0.0.1")).toEqual({ parentPath: "1.0.0", index: 2 });
    expect(insertTarget(tree, null)).toEqual({ parentPath: "", index: 3 });
    expect(insertTarget(tree, "1.0.1")).toEqual({ parentPath: "1.0", index: 2 });
  });
  it("runs insertElement for insert tools on the open page", () => {
    const store = createFakeStore({ page: "Home", tool: "ellipse", tree });
    boardPointerDown(store.getState(), store.actions, { page: "Home", board: "desktop", path: "1.0.0.1" });
    expect(store.calls).toEqual([{ name: "insertElement", args: ["ellipse", "1.0.0", 2] }]);
  });
  it("edits only text and link elements with the move tool", () => {
    const state = createFakeStore({ page: "Home", tool: "move", tree }).getState();
    expect(editablePath(state, { page: "Home", board: "desktop", path: "1.0.0.1" })).toBe("1.0.0.1");
    expect(editablePath(state, { page: "Home", board: "desktop", path: "1.0" })).toBeNull();
    expect(editablePath({ ...state, tool: "rect" }, { page: "Home", board: "desktop", path: "1.0.0.1" })).toBeNull();
  });
});
