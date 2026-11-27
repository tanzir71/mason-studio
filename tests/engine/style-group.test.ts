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

describe("style group", () => {
  it("writes a tablet override into styles.css and undoes it", async () => {
    const { s, fs } = await setup();
    const before = await fs.readText("styles.css");
    const r = await s.applyStyle({ page: "Home", path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" });
    expect(r).toEqual({ files: ["styles.css"], revision: 1, effective: true, path: null, message: "Saved to styles.css" });
    expect(await fs.readText("styles.css")).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
    expect((await s.inspect("Home", "1.0.0.1")).props["font-size"].values.tablet).toBe("30px");
    await s.undo();
    expect(await fs.readText("styles.css")).toBe(before);
  });
  it("reports effective false when another rule still wins", async () => {
    const { s, fs } = await setup();
    await fs.writeText("styles.css", (await fs.readText("styles.css")) + "\n#x, .hero .headline { color: red !important; }\n");
    const r = await s.applyStyle({ page: "Home", path: "1.0.0.1", prop: "color", value: "blue", scope: "mobile" });
    expect(r.effective).toBe(false);
  });
  it("resets a mobile override", async () => {
    const { s, fs } = await setup();
    await s.resetStyle("Home", "1.0.0.1", "font-size", "mobile");
    expect(await fs.readText("styles.css")).not.toContain("28px");
    expect((await s.inspect("Home", "1.0.0.1")).props["font-size"].values.mobile).toBe("32px");
  });
  it("rejects a reset with no override and pages without stylesheets", async () => {
    const { s } = await setup();
    await expect(s.resetStyle("Home", "1.0.0.2", "font-size", "tablet")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const bare = createStudio(createTestDeps({ "/b": { "index.html": "<html><head></head><body><p>x</p></body></html>" } }));
    await bare.openProject("/b");
    await expect(bare.applyStyle({ page: "Home", path: "0", prop: "color", value: "red", scope: "all" })).rejects.toMatchObject({ code: "NO_STYLESHEET" });
  });
});
