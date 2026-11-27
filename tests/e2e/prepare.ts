import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Fresh copy of the fixture for Playwright, as its own Git repository so Git features have a known state. */
const tmp = join("tests", ".tmp");
const project = join(tmp, "northfield");
rmSync(tmp, { recursive: true, force: true });
cpSync(join("tests", "fixtures", "northfield"), project, { recursive: true });
mkdirSync(join(tmp, "home"), { recursive: true });
const git = (...args: string[]) => execFileSync("git", args, { cwd: project, stdio: "ignore" });
git("init", "-q");
git("config", "user.name", "Mason Test");
git("config", "user.email", "test@example.com");
console.log("prepared tests/.tmp/northfield");
