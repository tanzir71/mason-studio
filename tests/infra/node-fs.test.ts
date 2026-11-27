import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createNodeFileSystem } from "../../src/server/infra/node-fs.ts";

describe("createNodeFileSystem", () => {
  it("exposes the resolved root", () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    expect(createNodeFileSystem(dir).root).toBe(resolve(dir));
    rmSync(dir, { recursive: true, force: true });
  });
  it("writes real files under the root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    await createNodeFileSystem(dir).writeText("css/a.css", "a{}");
    expect(readFileSync(join(dir, "css", "a.css"), "utf8")).toBe("a{}");
    rmSync(dir, { recursive: true, force: true });
  });
  it("lists a missing folder as an empty array", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    expect(await createNodeFileSystem(dir).list("nothing-here")).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
