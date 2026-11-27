import { MasonError } from "../../contracts/errors.ts";
import type { GitStatus } from "../../contracts/model.ts";
import type { GitRunner, StudioService } from "../../contracts/ports.ts";
import { requireProject } from "./context.ts";
import type { EngineContext } from "./context.ts";

/** Paths from `git status --porcelain=v1 -uall` lines ("XY path" or "XY old -> new"), quotes removed. */
export function parsePorcelain(stdout: string): string[] {
  return stdout.split("\n").filter((l) => l.length > 3).map((l) => {
    const rest = l.slice(3);
    const path = rest.includes(" -> ") ? rest.slice(rest.indexOf(" -> ") + 4) : rest;
    return path.replace(/^"(.*)"$/, "$1");
  });
}

/** First non-empty line of stderr, else of stdout, else "exit <code>". */
function failure(r: { code: number; stdout: string; stderr: string }): string {
  const line = (r.stderr || r.stdout).split("\n").map((s) => s.trim()).find(Boolean);
  return line ?? `exit ${r.code}`;
}

export async function statusOf(git: GitRunner): Promise<GitStatus> {
  const inside = await git.run(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return { isRepo: false, branch: null, changes: 0, files: [] };
  const branch = (await git.run(["branch", "--show-current"])).stdout.trim() || null;
  const files = parsePorcelain((await git.run(["status", "--porcelain=v1", "-uall"])).stdout);
  return { isRepo: true, branch, changes: files.length, files };
}

export function createGitGroup(ctx: EngineContext): Pick<StudioService, "gitStatus" | "commit"> {
  const git = () => ctx.deps.openGit(requireProject(ctx).root);
  return {
    gitStatus: () => statusOf(git()),
    async commit(message) {
      const text = message.trim();
      if (text === "") throw new MasonError("INVALID_INPUT", "The commit message is empty.");
      const g = git();
      if (!(await statusOf(g)).isRepo) throw new MasonError("GIT_FAILED", "This folder is not a Git repository.");
      const add = await g.run(["add", "-A"]);
      if (add.code !== 0) throw new MasonError("GIT_FAILED", failure(add));
      const commit = await g.run(["commit", "-m", text]);
      if (commit.code !== 0) throw new MasonError("GIT_FAILED", failure(commit));
      return statusOf(g);
    },
  };
}
