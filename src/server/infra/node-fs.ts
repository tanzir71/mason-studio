import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeFileSystem, FileSystem } from "../../contracts/ports.ts";

/** "\\" → "/", drop "" and "." segments, ".." pops a segment; absolute paths or escaping ".." → PATH_OUTSIDE_PROJECT. */
export function normalizeRelative(path: string): string {
  const p = path.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) throw new MasonError("PATH_OUTSIDE_PROJECT", path);
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) throw new MasonError("PATH_OUTSIDE_PROJECT", path);
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

const SKIP = new Set([".git", "node_modules"]);

export const createNodeFileSystem: CreateNodeFileSystem = (root: string): FileSystem => {
  const base = resolve(root);
  const abs = (path: string) => join(base, normalizeRelative(path));
  return {
    root: base,
    async readText(path) { return new TextDecoder().decode(await this.readBytes(path)); },
    async writeText(path, text) { await this.writeBytes(path, new TextEncoder().encode(text)); },
    async readBytes(path) {
      try {
        return new Uint8Array(await readFile(abs(path)));
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "EISDIR") throw new MasonError("FILE_NOT_FOUND", normalizeRelative(path));
        throw e;
      }
    },
    async writeBytes(path, data) {
      const full = abs(path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, data);
    },
    async exists(path) {
      try { await stat(abs(path)); return true; } catch { return false; }
    },
    async list(dir) {
      const results: string[] = [];
      const walk = async (current: string): Promise<void> => {
        let entries;
        try {
          entries = await readdir(current, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (SKIP.has(entry.name)) continue;
          const child = join(current, entry.name);
          if (entry.isDirectory()) {
            await walk(child);
          } else if (entry.isFile()) {
            results.push(child.slice(base.length + 1).replace(/\\/g, "/"));
          }
        }
      };
      await walk(abs(dir));
      return results.sort();
    },
  };
};
