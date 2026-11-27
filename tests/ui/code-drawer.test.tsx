// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CodeDrawer } from "../../src/ui/code/CodeDrawer.tsx";
import { Workspace } from "../../src/ui/app/Workspace.tsx";
import { StudioContext } from "../../src/contracts/ui.tsx";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import { createFakeStore } from "../../src/contracts/fakes-ui.ts";

// jsdom has no layout: CodeMirror measures text ranges, so give Range empty rects.
Range.prototype.getClientRects = function () { return [] as unknown as DOMRectList; };
Range.prototype.getBoundingClientRect = function () { return new DOMRect(); };

const open = { open: true, file: "styles.css", line: 1, text: "a {}\n", dirty: true };

describe("CodeDrawer", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<StudioContext.Provider value={createFakeStore()}><CodeDrawer /></StudioContext.Provider>);
    expect(container.innerHTML).toBe("");
  });
  it("shows the file with its unsaved state and saves or closes", async () => {
    const store = createFakeStore({ code: open });
    render(<StudioContext.Provider value={store}><CodeDrawer /></StudioContext.Provider>);
    const drawer = screen.getByTestId("code-drawer");
    expect(drawer).toHaveTextContent("styles.css");
    expect(screen.getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Close code" }));
    expect(store.calls.map((c) => c.name)).toEqual(["saveCode", "closeCode"]);
  });
  it("disables Save for a clean file", () => {
    render(<StudioContext.Provider value={createFakeStore({ code: { ...open, dirty: false } })}><CodeDrawer /></StudioContext.Provider>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
  it("is part of the workspace", () => {
    const project = { root: "/p", name: "p", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };
    render(<StudioContext.Provider value={createFakeStore({ screen: "canvas", project, page: "Home", code: open })}><Workspace /></StudioContext.Provider>);
    expect(screen.getByTestId("code-drawer")).toBeInTheDocument();
  });
});
