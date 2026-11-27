// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Canvas } from "../../src/ui/canvas/Canvas.tsx";
import { boardPointerDown, boardPointerMove, fitZoom, ROW_WIDTH } from "../../src/ui/canvas/tools.ts";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};

describe("Canvas", () => {
  it("renders a row of three boards per page", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    for (const id of ["Home-desktop", "Home-tablet", "Home-mobile", "Menu-desktop", "Menu-tablet", "Menu-mobile"]) {
      expect(screen.getByTestId(`board-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Menumenu.html" })).toBeInTheDocument();
    expect(screen.getByTestId("board-Home-desktop")).toHaveClass("is-active");
    expect(screen.getByTestId("board-Menu-desktop")).not.toHaveClass("is-active");
  });
  it("applies zoom and pan and shows the zoom value", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home", zoom: 0.5, pan: { x: 10, y: 20 } });
    const { container } = render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    expect(container.querySelector(".m-canvas__content")).toHaveStyle({ transform: "translate(10px, 20px) scale(0.5)" });
    expect(screen.getByText("50%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(store.calls.map((c) => [c.name, Math.round((c.args[0] as number) * 100)])).toEqual([["setZoom", 60], ["setZoom", 40]]);
  });
  it("activates a board of the open page and opens another page from its label", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><Canvas /></StudioContext.Provider>);
    fireEvent.click(screen.getByTestId("board-Home-mobile").querySelector("button")!);
    fireEvent.click(screen.getByTestId("board-Menu-tablet").querySelector("button")!);
    expect(store.calls).toEqual([{ name: "setActiveBoard", args: ["mobile"] }, { name: "selectPage", args: ["Menu"] }]);
  });
  it("renders nothing without a project", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><Canvas /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
});

describe("canvas tools", () => {
  it("fits the page row into a width", () => {
    expect(ROW_WIDTH).toBe(2615);
    expect([fitZoom(900), fitZoom(100), fitZoom(99999)]).toEqual([0.34, 0.1, 2]);
  });
  it("selects with the move tool and opens other pages", () => {
    const store = createFakeStore({ page: "Home", tool: "move", activeBoard: "desktop" });
    boardPointerDown(store.getState(), store.actions, { page: "Home", board: "tablet", path: "1.0" });
    boardPointerDown(store.getState(), store.actions, { page: "Menu", board: "desktop", path: "0" });
    boardPointerMove(store.getState(), store.actions, { page: "Home", board: "tablet", path: "1" });
    boardPointerMove(store.getState(), store.actions, { page: "Menu", board: "tablet", path: "1" });
    expect(store.calls).toEqual([
      { name: "setActiveBoard", args: ["tablet"] }, { name: "select", args: ["1.0"] },
      { name: "selectPage", args: ["Menu"] }, { name: "hover", args: ["1"] },
    ]);
  });
});
