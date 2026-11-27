/** Shared FileSystem contract suite. Planner-owned (protected): never edit. */
import { describe, expect, it } from "vitest";
import type { FileSystem } from "./ports.ts";

export function runFileSystemContract(label: string, make: () => Promise<{ fs: FileSystem; cleanup(): Promise<void> }>): void {
  describe(`FileSystem contract: ${label}`, () => {
    it("writes and reads text, creating parent folders", async () => {
      const { fs, cleanup } = await make();
      await fs.writeText("css/site/styles.css", "a { color: red; }");
      expect(await fs.readText("css/site/styles.css")).toBe("a { color: red; }");
      await cleanup();
    });
    it("round-trips bytes", async () => {
      const { fs, cleanup } = await make();
      await fs.writeBytes("img/a.bin", new Uint8Array([1, 2, 3]));
      expect([...(await fs.readBytes("img/a.bin"))]).toEqual([1, 2, 3]);
      await cleanup();
    });
    it("rejects a missing file with FILE_NOT_FOUND", async () => {
      const { fs, cleanup } = await make();
      await expect(fs.readText("missing.html")).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
      await cleanup();
    });
    it("lists files recursively, sorted, skipping .git and node_modules", async () => {
      const { fs, cleanup } = await make();
      for (const p of ["b.html", "a.html", "css/x.css", ".git/HEAD", "node_modules/m/i.js"]) await fs.writeText(p, "x");
      expect(await fs.list("")).toEqual(["a.html", "b.html", "css/x.css"]);
      expect(await fs.list("css")).toEqual(["css/x.css"]);
      await cleanup();
    });
    it("reports existence of files and folders", async () => {
      const { fs, cleanup } = await make();
      await fs.writeText("css/x.css", "x");
      expect(await fs.exists("css/x.css")).toBe(true);
      expect(await fs.exists("css")).toBe(true);
      expect(await fs.exists("nope.css")).toBe(false);
      await cleanup();
    });
    it("rejects paths outside the project", async () => {
      const { fs, cleanup } = await make();
      await expect(fs.readText("../secret.txt")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
      await expect(fs.writeText("/etc/x", "x")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
      await cleanup();
    });
    it("accepts backslash and ./ in paths", async () => {
      const { fs, cleanup } = await make();
      await fs.writeText("css\\y.css", "y");
      expect(await fs.readText("./css/y.css")).toBe("y");
      await cleanup();
    });
  });
}
