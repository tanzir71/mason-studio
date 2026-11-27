import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { pageSlug } from "../../src/engine/studio/page-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("createPage", () => {
  it("slugs page names", () => {
    expect(pageSlug("About us!")).toBe("about-us");
    expect(pageSlug("  Wholesale ")).toBe("wholesale");
    expect(pageSlug("!!")).toBe("");
  });
  it("creates the file from the first page's head with an empty main", async () => {
    const deps = createTestDeps({ "/p": fixtureFiles() });
    const studio = createStudio(deps);
    await studio.openProject("/p");
    const info = await studio.createPage("Wholesale");
    expect(info).toEqual({ name: "Wholesale", file: "wholesale.html", title: "Wholesale", stylesheets: ["tokens.css", "styles.css"] });
    const html = await deps.openFs("/p").readText("wholesale.html");
    expect(html).toContain("<title>Wholesale</title>");
    expect(html).toContain("<body>\n  <main></main>\n</body>");
    expect((await studio.currentProject()).pages.map((p) => p.name)).toEqual(["Home", "Menu", "Wholesale"]);
  });
  it("rejects an existing page and an empty slug", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.createPage("menu")).rejects.toMatchObject({ code: "PAGE_EXISTS" });
    await expect(studio.createPage("???")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
