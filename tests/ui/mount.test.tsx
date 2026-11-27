// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mountStudio } from "../../src/ui/main.tsx";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import { BREAKPOINTS } from "../../src/contracts/model.ts";
import type { ElementNode, ProjectInfo } from "../../src/contracts/model.ts";

const project: ProjectInfo = { root: "/p", name: "north", breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false, pages: [{ name: "Home", file: "index.html", title: "Home", stylesheets: [] }] };

describe("mountStudio", () => {
  it("renders the start screen when no project is open", async () => {
    const { client } = createFakeClient({ currentProject: async () => { throw new MasonError("NO_PROJECT"); } });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, client);
    await vi.waitFor(() => expect(el.querySelector('[data-testid="start-screen"]')).not.toBeNull());
    unmount();
    el.remove();
  });
  it("opens the canvas for the current project and unsubscribes on unmount", async () => {
    const { client } = createFakeClient({ currentProject: async () => project, pageTree: async () => ({ path: "", tag: "body", name: "Page", kind: "frame", children: [] } as unknown as ElementNode) });
    const off = vi.fn();
    const subscribe = vi.spyOn(client, "subscribe").mockReturnValue(off);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const unmount = mountStudio(el, client);
    await vi.waitFor(() => expect(el.querySelector('[data-testid="top-bar"]')).not.toBeNull());
    expect(el.textContent).toContain("north");
    expect(subscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(off).toHaveBeenCalledTimes(1);
    el.remove();
  });
});
