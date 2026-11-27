import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rawRequest } from "../helpers/http.ts";

let child: ChildProcess | null = null;
const dirs: string[] = [];
afterEach(() => { child?.kill(); child = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("mason CLI", () => {
  it("starts, prints the URL and serves the project", async () => {
    const base = mkdtempSync(join(tmpdir(), "mason-cli-"));
    dirs.push(base);
    cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
    child = spawn(process.execPath, ["src/cli/bin.ts", join(base, "north"), "--port", "0", "--no-open", "--home", join(base, "home")]);
    const url = await new Promise<string>((resolve, reject) => {
      let out = "";
      child!.stdout!.on("data", (c: Buffer) => { out += c.toString(); const m = out.match(/Mason is running at (http:\/\/127\.0\.0\.1:\d+\/)/); if (m) resolve(m[1]); });
      child!.on("exit", (code) => reject(new Error(`exited ${code}: ${out}`)));
    });
    const port = Number(new URL(url).port);
    const r = await rawRequest(port, "POST", "/api/rpc/currentProject", { body: "{}" });
    expect(JSON.parse(r.body).result.name).toBe("north");
  });
  it("prints help and exits 0", async () => {
    const code = await new Promise<number | null>((resolve) => {
      child = spawn(process.execPath, ["src/cli/bin.ts", "--help"]);
      child.on("exit", resolve);
    });
    expect(code).toBe(0);
  });
});
