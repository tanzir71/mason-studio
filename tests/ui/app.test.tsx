// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../../src/ui/app/App.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };

describe("App", () => {
  it("shows the start screen before a project is open", () => {
    render(<StudioContext.Provider value={createFakeStore()}><App /></StudioContext.Provider>);
    expect(screen.getByTestId("start-screen")).toHaveTextContent("Mason");
  });
  it("shows the workspace for an open project", () => {
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home" })}><App /></StudioContext.Provider>);
    for (const id of ["top-bar", "left-panel", "canvas", "tool-dock", "right-panel"]) expect(screen.getByTestId(id)).toBeInTheDocument();
  });
  it("applies the theme from settings", () => {
    render(<StudioContext.Provider value={createFakeStore({ settings: { ...DEFAULT_SETTINGS, theme: "light" } })}><App /></StudioContext.Provider>);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("runs keyboard shortcuts on the canvas but not while typing", () => {
    const store = createFakeStore({ screen: "canvas", project, page: "Home" });
    render(<StudioContext.Provider value={store}><App /></StudioContext.Provider>);
    fireEvent.keyDown(window, { key: "h" });
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "r" });
    input.remove();
    expect(store.calls.filter((c) => c.name === "setTool")).toEqual([{ name: "setTool", args: ["hand"] }]);
  });
});
