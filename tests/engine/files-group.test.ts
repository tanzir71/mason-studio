import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { cleanPath } from "../../src/engine/studio/files-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}

describe("files group", () => {
  it("cleans paths", () => {
    expect(cleanPath(".\\css\\a.css")).toBe("css/a.css");
    expect(cleanPath("./styles.css")).toBe("styles.css");
  });
  it("reads a project file", async () => {
    const { s } = await setup();
    const f = await s.readFile("./styles.css");
    expect(f.path).toBe("styles.css");
    expect(f.text).toBe(fixtureFiles()["styles.css"]);
    await expect(s.readFile("nope.css")).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    await expect(s.readFile("../x")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
  it("writes a file as one undo step and refreshes page titles", async () => {
    const { s, fs } = await setup();
    const html = fixtureFiles()["menu.html"].replace("<title>Menu</title>", "<title>Our menu</title>");
    const r = await s.writeFile("menu.html", html);
    expect(r).toMatchObject({ files: ["menu.html"], message: "Saved to menu.html" });
    expect((await s.currentProject()).pages[1].title).toBe("Our menu");
    await s.undo();
    expect(await fs.readText("menu.html")).toBe(fixtureFiles()["menu.html"]);
  });
});
