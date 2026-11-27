import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { parsePorcelain } from "../../src/engine/studio/git-group.ts";
import { createTestDeps, FakeGitRunner } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

const ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
async function setup(responses: ConstructorParameters<typeof FakeGitRunner>[0]) {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const git = new FakeGitRunner(responses);
  deps.gitByRoot.set("/p", git);
  const s = createStudio(deps);
  await s.openProject("/p");
  return { s, git };
}
const repo = { "rev-parse --is-inside-work-tree": ok("true\n"), "branch --show-current": ok("main\n"), "status --porcelain=v1 -uall": ok(" M styles.css\n?? about.html\nR  old.css -> new.css\n") };

describe("git group", () => {
  it("parses porcelain status lines", () => {
    expect(parsePorcelain(' M styles.css\n?? "a b.html"\nR  old.css -> new.css\n')).toEqual(["styles.css", "a b.html", "new.css"]);
  });
  it("reports branch and changed files", async () => {
    const { s } = await setup(repo);
    expect(await s.gitStatus()).toEqual({ isRepo: true, branch: "main", changes: 3, files: ["styles.css", "about.html", "new.css"] });
  });
  it("reports a folder that is not a repository", async () => {
    const { s } = await setup({ "rev-parse --is-inside-work-tree": { code: 128, stdout: "", stderr: "fatal: not a git repository" } });
    expect(await s.gitStatus()).toEqual({ isRepo: false, branch: null, changes: 0, files: [] });
    await expect(s.commit("x")).rejects.toMatchObject({ code: "GIT_FAILED", message: "Git command failed. This folder is not a Git repository." });
  });
  it("adds and commits with the message", async () => {
    const { s, git } = await setup(repo);
    await s.commit("  Tighter headline  ");
    expect(git.calls.filter((c) => c[0] === "add" || c[0] === "commit")).toEqual([["add", "-A"], ["commit", "-m", "Tighter headline"]]);
  });
  it("rejects an empty message and reports git errors", async () => {
    const { s } = await setup({ ...repo, "commit -m x": { code: 1, stdout: "nothing to commit, working tree clean\n", stderr: "" } });
    await expect(s.commit(" ")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(s.commit("x")).rejects.toMatchObject({ code: "GIT_FAILED", message: "Git command failed. nothing to commit, working tree clean" });
  });
});
