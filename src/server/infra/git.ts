import { spawn } from "node:child_process";
import type { CreateNodeGitRunner, GitResult } from "../../contracts/ports.ts";

/** Runs `git <args>` in root. Never throws: a missing git binary gives code 127 with the error message in stderr. */
export const createNodeGitRunner: CreateNodeGitRunner = (root) => ({
  run(args: string[]): Promise<GitResult> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let child;
      try {
        child = spawn("git", args, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, windowsHide: true });
      } catch (error) {
        resolve({ code: 127, stdout: "", stderr: error instanceof Error ? error.message : String(error) });
        return;
      }
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (c: string) => { stdout += c; });
      child.stderr.on("data", (c: string) => { stderr += c; });
      child.on("error", (error) => resolve({ code: 127, stdout, stderr: error.message }));
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
  },
});
