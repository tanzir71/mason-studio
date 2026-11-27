// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { StartScreen, formatAgo } from "../../src/ui/start/StartScreen.tsx";
import { App } from "../../src/ui/app/App.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import type { TemplateInfo } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const templates: TemplateInfo[] = [{ id: "landing", name: "Landing page", meta: "1 page" }, { id: "blank", name: "Blank", meta: "Empty folder" }];
const now = Date.now();
afterEach(() => { delete window.masonDesktop; });

describe("StartScreen", () => {
  it("formats how long ago a project was opened", () => {
    const t = 1_700_000_000_000;
    expect([formatAgo(t, t + 30_000), formatAgo(t, t + 12 * 60_000), formatAgo(t, t + 3 * 3_600_000), formatAgo(t, t + 30 * 3_600_000)]).toEqual(["just now", "12 min ago", "3 h ago", "Yesterday"]);
    expect(formatAgo(Date.UTC(2026, 10, 19, 12), Date.UTC(2026, 10, 27, 12))).toBe("Nov 19");
  });
  it("opens recent projects and typed folders", async () => {
    const store = createFakeStore({ recent: [{ root: "/sites/north", name: "north", openedAt: now - 120_000 }], templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    expect(screen.getByRole("heading", { name: "Start designing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /north/ }));
    await userEvent.type(screen.getByLabelText("Folder path"), "/sites/other{Enter}");
    expect(store.calls).toEqual([{ name: "openProject", args: ["/sites/north"] }, { name: "openProject", args: ["/sites/other"] }]);
  });
  it("creates a project from a chosen template", async () => {
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: /Landing page/ }));
    expect(screen.getByRole("button", { name: /Landing page/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByLabelText("New folder path"), "/sites/new{Enter}");
    expect(store.calls).toEqual([{ name: "createProject", args: ["/sites/new", "landing"] }]);
  });
  it("uses the desktop folder picker when it exists", async () => {
    window.masonDesktop = { isDesktop: true, pickFolder: async () => "/picked" };
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><StartScreen /></StudioContext.Provider>);
    expect(screen.queryByLabelText("Folder path")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    expect(store.calls).toEqual([{ name: "openProject", args: ["/picked"] }]);
  });
  it("is the app's start screen with settings", async () => {
    const store = createFakeStore({ templates });
    render(<StudioContext.Provider value={store}><App /></StudioContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(store.calls).toEqual([{ name: "openSettings", args: [] }]);
  });
});
