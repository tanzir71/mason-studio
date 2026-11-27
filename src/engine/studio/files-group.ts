import type { StudioService } from "../../contracts/ports.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { scanPages } from "./project-group.ts";
import { commitChanges } from "./write.ts";

/** "\\" → "/", leading "./" and "/" removed. The FileSystem still rejects ".." escapes. */
export function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

export function createFilesGroup(ctx: EngineContext): Pick<StudioService, "readFile" | "writeFile"> {
  return {
    async readFile(path) {
      const fs = requireFs(ctx);
      const clean = cleanPath(path);
      return { path: clean, text: await fs.readText(clean) };
    },
    async writeFile(path, text) {
      const fs = requireFs(ctx);
      const clean = cleanPath(path);
      const result = await commitChanges(ctx, [{ path: clean, after: text }]);
      if (!clean.includes("/") && clean.endsWith(".html") && ctx.project) ctx.project = { ...ctx.project, pages: await scanPages(fs) };
      return result;
    },
  };
}
