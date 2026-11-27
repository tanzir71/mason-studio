import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import { MasonError } from "../../src/contracts/errors.ts";
import type { ElementNode, PageInfo, ProjectInfo } from "../../src/contracts/model.ts";
import { STORE_ACTION_NAMES } from "../../src/ui/state/store-context.ts";
import { BREAKPOINTS } from "../../src/contracts/model.ts";

const page = (name: string, file: string): PageInfo => ({ name, file, title: name, stylesheets: ["styles.css"] });
const project: ProjectInfo = { root: "/p", name: "p", pages: [page("Home", "index.html"), page("Menu", "menu.html")], breakpoints: [...BREAKPOINTS], hasTokens: false, hasTaste: false };
const tree = (tag: string) => ({ tag, path: "", children: [] } as unknown as ElementNode);

describe("store core and project actions", () => {
  it("starts from INITIAL_STATE and notifies subscribers", () => {
    const store = createStudioStore(createFakeClient().client);
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.setState({ zoom: 1 });
    store.setState((s) => ({ zoom: s.zoom + 0.5 }));
    expect([store.getState().zoom, store.getState().screen, calls]).toEqual([1.5, "start", 2]);
  });
  it("init stays on the start screen when no project is open", async () => {
    const { client } = createFakeClient({
      recentProjects: async () => [{ root: "/a", name: "a", openedAt: 1 }],
      templates: async () => [],
      currentProject: async () => { throw new MasonError("NO_PROJECT"); },
    });
    const store = createStudioStore(client);
    await store.actions.init();
    expect(store.getState()).toMatchObject({ screen: "start", recent: [{ root: "/a" }], settings: null, toast: null });
  });
  it("init enters the open project with its first page", async () => {
    const { client } = createFakeClient({ currentProject: async () => project, pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    await store.actions.init();
    expect(store.getState()).toMatchObject({ screen: "canvas", page: "Home", tree: { tag: "Home" }, git: null, tokens: null, proposals: [] });
  });
  it("selectPage loads the tree and clears the selection", async () => {
    const { client } = createFakeClient({ pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    store.setState({ screen: "canvas", project, page: "Home", selection: "1.0" });
    await store.actions.selectPage("Menu");
    expect(store.getState()).toMatchObject({ page: "Menu", selection: null, tree: { tag: "Menu" } });
  });
  it("turns action errors into error toasts", async () => {
    const store = createStudioStore(createFakeClient({ openProject: async () => { throw new MasonError("NOT_A_PROJECT", "/x"); } }).client);
    await store.actions.openProject("/x");
    expect(store.getState().toast).toEqual({ id: 1, tone: "error", text: "That folder has no .html files. /x", undo: false });
    expect(store.getState().screen).toBe("start");
  });
  it("createPage refreshes the project and opens the new page", async () => {
    const withPage = { ...project, pages: [...project.pages, page("Wholesale", "wholesale.html")] };
    const { client } = createFakeClient({ createPage: async () => page("Wholesale", "wholesale.html"), currentProject: async () => withPage, pageTree: async (p) => tree(p) });
    const store = createStudioStore(client);
    store.setState({ screen: "canvas", project, page: "Home" });
    await store.actions.createPage("Wholesale");
    expect(store.getState().project!.pages.length).toBe(3);
    expect(store.getState().page).toBe("Wholesale");
  });
  it("closeProject returns to the start screen", () => {
    const store = createStudioStore(createFakeClient({ recentProjects: async () => [] }).client);
    store.setState({ screen: "canvas", project, page: "Home", selection: "0" });
    store.actions.closeProject();
    expect(store.getState()).toMatchObject({ screen: "start", project: null, page: null, selection: null });
  });
  it("exposes every action as a function", () => {
    const store = createStudioStore(createFakeClient().client);
    for (const name of STORE_ACTION_NAMES) expect(typeof store.actions[name]).toBe("function");
  });
});
