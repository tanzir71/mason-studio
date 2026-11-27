// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { GitChip } from "../../src/ui/app/GitChip.tsx";
import { TopBar } from "../../src/ui/app/TopBar.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

const git = { isRepo: true, branch: "main", changes: 3, files: ["a", "b", "c"] };

describe("GitChip", () => {
  it("shows the number of changes and commits with a message", async () => {
    const store = createFakeStore({ git });
    render(<StudioContext.Provider value={store}><GitChip /></StudioContext.Provider>);
    expect(screen.getByTestId("git-chip")).toHaveTextContent("3 changes");
    await userEvent.click(screen.getByRole("button", { name: "Commit" }));
    await userEvent.type(screen.getByLabelText("Commit message"), "Tighter headline{Enter}");
    expect(store.calls).toEqual([{ name: "commit", args: ["Tighter headline"] }]);
    expect(screen.queryByLabelText("Commit message")).toBeNull();
  });
  it("disables Commit without changes and says when there is no Git", () => {
    const { unmount } = render(<StudioContext.Provider value={createFakeStore({ git: { ...git, changes: 0, files: [] } })}><GitChip /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    unmount();
    render(<StudioContext.Provider value={createFakeStore({ git: null })}><GitChip /></StudioContext.Provider>);
    expect(screen.getByTestId("git-chip")).toHaveTextContent("No Git");
  });
  it("sits in the top bar", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", git })}><TopBar /></StudioContext.Provider>);
    expect(screen.getByTestId("top-bar")).toContainElement(screen.getByTestId("git-chip"));
  });
});
