// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { LeftPanel } from "../../src/ui/panels/LeftPanel.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};
const renderPanel = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", project, page: "Home", ...state });
  render(<StudioContext.Provider value={store}><LeftPanel /></StudioContext.Provider>);
  return store;
};

describe("LeftPanel", () => {
  it("lists pages with their files and marks the open page", () => {
    renderPanel();
    const pages = screen.getByTestId("pages-list");
    expect(within(pages).getByRole("button", { name: "Homeindex.html" })).toHaveClass("is-selected");
    expect(within(pages).getByRole("button", { name: "Menumenu.html" })).not.toHaveClass("is-selected");
    expect(screen.getByTestId("layers-tree")).toBeInTheDocument();
  });
  it("opens a page and creates a new one", async () => {
    const store = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Menumenu.html" }));
    await userEvent.click(screen.getByRole("button", { name: "New page" }));
    await userEvent.type(screen.getByLabelText("New page name"), "Wholesale{Enter}");
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }, { name: "createPage", args: ["Wholesale"] }]);
    expect(screen.queryByLabelText("New page name")).toBeNull();
  });
  it("switches to the assets tab", async () => {
    const store = renderPanel();
    await userEvent.click(screen.getByRole("tab", { name: "Assets" }));
    expect(store.calls).toEqual([{ name: "setLeftTab", args: ["assets"] }]);
  });
  it("shows the assets area when the assets tab is open", () => {
    renderPanel({ leftTab: "assets" });
    expect(screen.getByTestId("assets-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("pages-list")).toBeNull();
  });
});
