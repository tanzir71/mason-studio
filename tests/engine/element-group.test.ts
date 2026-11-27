import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}

describe("element group", () => {
  it("inserts an element into the page and its rule into the last stylesheet", async () => {
    const { s, fs } = await setup();
    const r = await s.insertElement("Home", "1.0.0", 4, "ellipse");
    expect(r).toMatchObject({ files: ["index.html", "styles.css"], path: "1.0.0.4", message: "Saved to index.html, styles.css" });
    expect(await fs.readText("index.html")).toContain('<div class="ellipse-1"></div>');
    expect(await fs.readText("styles.css")).toContain(".ellipse-1 {\n  width: 120px;");
    expect((await s.pageTree("Home")).children[1].children[0].children[0].children[4].name).toBe("Ellipse 1");
  });
  it("edits text, removes, moves and wraps, each as one undo step", async () => {
    const { s, fs } = await setup();
    await s.editText("Home", "1.0.0.1", "Fresh beans");
    expect((await s.moveElement("Home", "1.0.0.0", 1)).path).toBe("1.0.0.1");
    expect((await s.wrapInStack("Home", "1.0.0.3")).path).toBe("1.0.0.3");
    await s.removeElement("Home", "2");
    const html = await fs.readText("index.html");
    expect(html).toContain("Fresh beans");
    expect(html).not.toContain("<footer");
    await s.undo(); await s.undo(); await s.undo(); await s.undo();
    expect(await fs.readText("index.html")).toBe(fixtureFiles()["index.html"]);
  });
  it("rejects a move that changes nothing", async () => {
    const { s } = await setup();
    await expect(s.moveElement("Home", "1.0.0.1", 1)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
