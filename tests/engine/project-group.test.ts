import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

const templates = {
  "blank/template.json": '{ "id": "blank", "name": "Blank", "meta": "Empty folder" }',
  "landing/template.json": '{ "id": "landing", "name": "Landing page", "meta": "1 page" }',
};

describe("project group", () => {
  it("opens a project with pages, flags and breakpoints", async () => {
    const studio = createStudio(createTestDeps({ "/sites/north": fixtureFiles() }));
    const p = await studio.openProject("/sites/north");
    expect(p.name).toBe("north");
    expect(p.root).toBe("/sites/north");
    expect(p.pages).toEqual([
      { name: "Home", file: "index.html", title: "Northfield Coffee", stylesheets: ["tokens.css", "styles.css"] },
      { name: "Menu", file: "menu.html", title: "Menu", stylesheets: ["tokens.css", "styles.css"] },
    ]);
    expect([p.hasTokens, p.hasTaste, p.breakpoints.length]).toEqual([true, true, 3]);
    expect(await studio.currentProject()).toEqual(p);
  });
  it("rejects a folder without top-level html files", async () => {
    const studio = createStudio(createTestDeps({ "/empty": { "notes.txt": "x", "sub/page.html": "<p>x</p>" } }));
    await expect(studio.openProject("/empty")).rejects.toMatchObject({ code: "NOT_A_PROJECT" });
  });
  it("rejects currentProject before a project is open", async () => {
    await expect(createStudio(createTestDeps()).currentProject()).rejects.toMatchObject({ code: "NO_PROJECT" });
  });
  it("records recent projects newest first and emits project-opened", async () => {
    const deps = createTestDeps({ "/a": { "index.html": "<p>a</p>" }, "/b": { "index.html": "<p>b</p>" } });
    const studio = createStudio(deps);
    await studio.openProject("/a");
    await studio.openProject("/b");
    await studio.openProject("/a");
    expect((await studio.recentProjects()).map((r) => r.root)).toEqual(["/a", "/b"]);
    expect(deps.events.emitted.map((e) => e.type)).toEqual(["project-opened", "project-opened", "project-opened"]);
  });
  it("lists templates in the fixed order", async () => {
    const studio = createStudio(createTestDeps({}, templates));
    expect(await studio.templates()).toEqual([
      { id: "landing", name: "Landing page", meta: "1 page" },
      { id: "blank", name: "Blank", meta: "Empty folder" },
    ]);
  });
});
