import { describe, expect, it } from "vitest";
import { createEngineContext } from "../../src/engine/studio/context.ts";
import { createProjectGroup } from "../../src/engine/studio/project-group.ts";
import { commitChanges, createHistoryGroup, writeEdits } from "../../src/engine/studio/write.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";

async function setup() {
  const deps = createTestDeps({ "/p": { "index.html": "<p>x</p>", "a.css": "a { color: red; }\n" } });
  const ctx = createEngineContext(deps);
  await createProjectGroup(ctx).openProject("/p");
  deps.events.emitted.length = 0;
  return { deps, ctx, fs: deps.openFs("/p"), history: createHistoryGroup(ctx) };
}

describe("write pipeline", () => {
  it("applies edits per file as one step and emits written", async () => {
    const { ctx, fs, deps } = await setup();
    const r = await writeEdits(ctx, [{ file: "a.css", start: 11, end: 14, text: "blue" }, { file: "b.css", start: 0, end: 0, text: "b {}\n" }]);
    expect(r).toEqual({ files: ["a.css", "b.css"], revision: 1, effective: true, path: null, message: "Saved to a.css, b.css" });
    expect(await fs.readText("a.css")).toBe("a { color: blue; }\n");
    expect(ctx.undoStack.length).toBe(1);
    expect(deps.events.emitted).toEqual([{ type: "written", files: ["a.css", "b.css"], revision: 1 }]);
  });
  it("undoes and redoes a step", async () => {
    const { ctx, fs, history } = await setup();
    await commitChanges(ctx, [{ path: "a.css", after: "a {}\n" }], { message: "Saved to a.css", path: "1" });
    const u = await history.undo();
    expect([u.message, u.revision, await fs.readText("a.css")]).toEqual(["Undid: Saved to a.css", 2, "a { color: red; }\n"]);
    const r = await history.redo();
    expect([r.message, r.revision, await fs.readText("a.css")]).toEqual(["Redid: Saved to a.css", 3, "a {}\n"]);
  });
  it("empties a created file on undo and clears redo on a new write", async () => {
    const { ctx, fs, history } = await setup();
    await commitChanges(ctx, [{ path: "new.css", after: "x {}\n" }]);
    await history.undo();
    expect(await fs.readText("new.css")).toBe("");
    await commitChanges(ctx, [{ path: "a.css", after: "z {}\n" }]);
    await expect(history.redo()).rejects.toMatchObject({ code: "NOTHING_TO_REDO" });
  });
  it("rejects undo with an empty history and writes that change nothing", async () => {
    const { ctx, history } = await setup();
    await expect(history.undo()).rejects.toMatchObject({ code: "NOTHING_TO_UNDO" });
    await expect(commitChanges(ctx, [{ path: "a.css", after: "a { color: red; }\n" }])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
