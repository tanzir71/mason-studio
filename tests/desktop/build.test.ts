import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

describe("desktop bundle", () => {
  it("bundles main as ESM and the preload as CommonJS", () => {
    const out = execFileSync(process.execPath, ["src/desktop/build.ts"], { encoding: "utf8" });
    expect(out).toContain("built dist/desktop");
    const main = readFileSync("dist/desktop/main.mjs", "utf8");
    expect(main).toMatch(/from "electron"/);
    expect(main).toContain("MASON SMOKE OK");
    expect(main).not.toContain('require("electron")');
    const preload = readFileSync("dist/desktop/preload.cjs", "utf8");
    expect(preload).toContain('require("electron")');
    expect(preload).toContain("masonDesktop");
  });
});
