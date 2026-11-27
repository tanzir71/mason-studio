import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";

const templates = {
  "blank/template.json": '{ "id": "blank", "name": "Blank", "meta": "Empty folder" }',
  "blank/index.html": "<!doctype html><html><head><title>Untitled</title></head><body><main></main></body></html>",
  "blank/css/styles.css": "body { margin: 0; }",
};

describe("createProject", () => {
  it("copies the template without template.json and opens it", async () => {
    const deps = createTestDeps({}, templates);
    const p = await createStudio(deps).createProject("/new/site", "blank");
    expect(p.pages.map((x) => x.file)).toEqual(["index.html"]);
    expect(await deps.openFs("/new/site").list("")).toEqual(["css/styles.css", "index.html"]);
  });
  it("refuses a folder that is not empty", async () => {
    const studio = createStudio(createTestDeps({ "/busy": { "a.txt": "x" } }, templates));
    await expect(studio.createProject("/busy", "blank")).rejects.toMatchObject({ code: "FOLDER_NOT_EMPTY" });
  });
  it("refuses an unknown template", async () => {
    const studio = createStudio(createTestDeps({}, templates));
    await expect(studio.createProject("/x", "fancy" as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
