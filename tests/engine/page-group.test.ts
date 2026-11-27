import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createEngineContext } from "../../src/engine/studio/context.ts";
import { createProjectGroup } from "../../src/engine/studio/project-group.ts";
import { loadPage } from "../../src/engine/studio/page-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("page group", () => {
  it("returns the body tree of a page", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    const body = await studio.pageTree("Home");
    expect(body.tag).toBe("body");
    expect(body.children.map((c) => c.name)).toEqual(["Header", "Main", "Footer"]);
  });
  it("rejects an unknown page with PAGE_NOT_FOUND", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.pageTree("Nope")).rejects.toMatchObject({ code: "PAGE_NOT_FOUND" });
  });
  it("loads the page with its existing stylesheets parsed in order", async () => {
    const files = fixtureFiles();
    delete files["tokens.css"];
    const ctx = createEngineContext(createTestDeps({ "/p": files }));
    await createProjectGroup(ctx).openProject("/p");
    const loaded = await loadPage(ctx, "Home");
    expect(loaded.info.file).toBe("index.html");
    expect(loaded.html.startsWith("<!doctype html>")).toBe(true);
    expect(loaded.sheets.map((s) => s.file)).toEqual(["styles.css"]);
    expect(loaded.sheets[0].rules.length).toBe(14);
  });
});
