import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeGitRunner } from "../../src/server/infra/git.ts";

describe("createNodeGitRunner", () => {
  it("runs git in the project folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-git-"));
    const git = createNodeGitRunner(dir);
    expect((await git.run(["init", "-q"])).code).toBe(0);
    writeFileSync(join(dir, "index.html"), "<p>x</p>");
    const status = await git.run(["status", "--porcelain=v1", "-uall"]);
    expect([status.code, status.stdout]).toEqual([0, "?? index.html\n"]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("returns a non-zero code instead of throwing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-git-"));
    const r = await createNodeGitRunner(dir).run(["rev-parse", "--is-inside-work-tree"]);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("not a git repository");
    rmSync(dir, { recursive: true, force: true });
  });
});
