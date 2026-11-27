// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TopBar } from "../../src/ui/app/TopBar.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS, DEFAULT_SETTINGS } from "../../src/contracts/model.ts";
import type { ProjectInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const project: ProjectInfo = {
  root: "/p", name: "northfield-site", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false,
  pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }, { name: "Menu", file: "menu.html", title: "Menu", stylesheets: [] }],
};
const renderBar = (state = {}) => {
  const store = createFakeStore({ screen: "canvas", project, page: "Home", ...state });
  render(<StudioContext.Provider value={store}><TopBar /></StudioContext.Provider>);
  return store;
};

describe("TopBar", () => {
  it("shows project, page and the breakpoint strip", () => {
    renderBar({ activeBoard: "tablet" });
    expect(screen.getByTestId("top-bar")).toHaveTextContent("northfield-site");
    const strip = screen.getByTestId("breakpoint-strip");
    expect(strip).toHaveTextContent("Desktop1280Tablet≤ 768Mobile≤ 375");
    expect(screen.getByRole("button", { name: /Tablet/ })).toHaveAttribute("aria-pressed", "true");
  });
  it("switches boards from the strip", async () => {
    const store = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Mobile/ }));
    expect(store.calls).toEqual([{ name: "setActiveBoard", args: ["mobile"] }]);
  });
  it("opens pages and project actions from the menus", async () => {
    const store = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Menu/ }));
    await userEvent.click(screen.getByRole("button", { name: "northfield-site" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Close project" }));
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }, { name: "closeProject", args: [] }]);
  });
  it("shows the MCP state and previews the page", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderBar({ settings: { ...DEFAULT_SETTINGS, mcpEnabled: true } });
    expect(screen.getByRole("button", { name: "MCP on" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview page" }));
    expect(open).toHaveBeenCalledWith("/p/index.html", "_blank", "noopener");
    open.mockRestore();
  });
});
