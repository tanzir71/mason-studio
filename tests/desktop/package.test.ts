import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const builder = readFileSync("electron-builder.yml", "utf8");

describe("desktop packaging setup", () => {
  it("pins Electron and electron-builder and points main at the bundle", () => {
    expect(pkg.devDependencies.electron).toBe("45.5.0");
    expect(pkg.devDependencies["electron-builder"]).toBe("26.18.0");
    expect(pkg.dependencies.electron).toBeUndefined();
    expect(pkg.main).toBe("dist/desktop/main.mjs");
  });
  it("adds the desktop scripts", () => {
    expect(pkg.scripts["desktop:build"]).toBe("node src/desktop/build.ts");
    expect(pkg.scripts.desktop).toBe("vite build && node src/desktop/build.ts && electron .");
    expect(pkg.scripts["desktop:dist"]).toBe("vite build && node src/desktop/build.ts && electron-builder");
  });
  it("packages dist and templates without asar", () => {
    expect(builder).toContain("appId: dev.mason.app");
    expect(builder).toContain("  - templates/**");
    expect(builder).toContain("asar: false");
  });
});
