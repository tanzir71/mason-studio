import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup(files = fixtureFiles()) {
  const deps = createTestDeps({ "/p": files });
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, fs: deps.openFs("/p") };
}
const studioJson = JSON.stringify({ core: { color: { brand: { value: "#123456", type: "color" } } } });

describe("tokens group", () => {
  it("reads tokens.json, or an empty set without one", async () => {
    expect((await (await setup()).s.tokens()).tokens.length).toBe(8);
    const files = fixtureFiles();
    delete files["tokens.json"];
    expect(await (await setup(files)).s.tokens()).toEqual({ tokens: [], file: null });
  });
  it("imports Tokens Studio JSON into tokens.json and tokens.css as one undo step", async () => {
    const { s, fs } = await setup();
    const set = await s.importTokens("tokens-studio", studioJson);
    expect(set.tokens.map((t) => t.name)).toEqual(["color.brand"]);
    expect(await fs.readText("tokens.css")).toContain("--color-brand: #123456;");
    expect(JSON.parse(await fs.readText("tokens.json"))).toEqual({ color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [0.0706, 0.2039, 0.3373], hex: "#123456" } } } });
    await s.undo();
    expect(await fs.readText("tokens.css")).toBe(fixtureFiles()["tokens.css"]);
  });
  it("rewrites tokens.css from tokens.json and reports when it is up to date", async () => {
    const { s, fs } = await setup();
    expect((await s.exportTokens()).message).toBe("tokens.css is up to date.");
    await fs.writeText("tokens.css", "stale");
    const r = await s.exportTokens();
    expect(r).toMatchObject({ files: ["tokens.css"], message: "Saved to tokens.css" });
    expect(await fs.readText("tokens.css")).toBe(fixtureFiles()["tokens.css"]);
  });
});
