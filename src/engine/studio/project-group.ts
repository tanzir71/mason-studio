import { BREAKPOINTS } from "../../contracts/model.ts";
import type { PageInfo, ProjectInfo, TemplateId, TemplateInfo } from "../../contracts/model.ts";
import { MasonError } from "../../contracts/errors.ts";
import type { FileSystem, StudioService } from "../../contracts/ports.ts";
import { requireProject } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { parsePage } from "../html/parse.ts";
import { humanize } from "../html/names.ts";

export function pageNameOf(file: string): string {
  if (file === "index.html") return "Home";
  return humanize(file.replace(/\.html$/i, ""));
}

export async function scanPages(fs: FileSystem): Promise<PageInfo[]> {
  const files = (await fs.list("")).filter((f) => !f.includes("/") && f.toLowerCase().endsWith(".html"));
  files.sort((a, b) => {
    if (a === "index.html") return -1;
    if (b === "index.html") return 1;
    return a.localeCompare(b);
  });
  const pages: PageInfo[] = [];
  for (const file of files) {
    const model = parsePage(file, await fs.readText(file));
    pages.push({ name: pageNameOf(file), file, title: model.title, stylesheets: model.stylesheets });
  }
  return pages;
}

const TEMPLATE_ORDER: TemplateId[] = ["landing", "portfolio", "docs", "blank"];

export function createProjectGroup(ctx: EngineContext): Pick<StudioService, "openProject" | "currentProject" | "recentProjects" | "templates" | "createProject"> {
  const group: Pick<StudioService, "openProject" | "currentProject" | "recentProjects" | "templates" | "createProject"> = {
    async openProject(root: string): Promise<ProjectInfo> {
      const fs = ctx.deps.openFs(root);
      const pages = await scanPages(fs);
      if (pages.length === 0) throw new MasonError("NOT_A_PROJECT", root);
      const name = root.split(/[\\/]/).filter(Boolean).pop() ?? root;
      const project: ProjectInfo = {
        root,
        name,
        pages,
        breakpoints: [...BREAKPOINTS],
        hasTokens: await fs.exists("tokens.json"),
        hasTaste: await fs.exists(".mason/taste.md"),
      };
      ctx.project = project;
      ctx.fs = fs;
      ctx.undoStack = [];
      ctx.redoStack = [];
      ctx.proposals = [];
      const stored = await ctx.deps.settings.load();
      stored.recent = [{ root, name, openedAt: ctx.deps.now() }, ...stored.recent.filter((r) => r.root !== root)].slice(0, 8);
      await ctx.deps.settings.save(stored);
      ctx.deps.events.emit({ type: "project-opened", project });
      return project;
    },
    async currentProject(): Promise<ProjectInfo> {
      return requireProject(ctx);
    },
    async recentProjects() {
      return (await ctx.deps.settings.load()).recent;
    },
    async templates(): Promise<TemplateInfo[]> {
      const tfs = ctx.deps.openFs(ctx.deps.templatesDir);
      const out: TemplateInfo[] = [];
      for (const id of TEMPLATE_ORDER) {
        if (await tfs.exists(`${id}/template.json`)) {
          const info = JSON.parse(await tfs.readText(`${id}/template.json`)) as TemplateInfo;
          out.push({ id, name: info.name, meta: info.meta });
        }
      }
      return out;
    },
    async createProject(root: string, template: TemplateId): Promise<ProjectInfo> {
      if (!TEMPLATE_ORDER.includes(template)) throw new MasonError("INVALID_INPUT", template);
      const target = ctx.deps.openFs(root);
      if ((await target.list("")).length > 0) throw new MasonError("FOLDER_NOT_EMPTY", root);
      const tfs = ctx.deps.openFs(ctx.deps.templatesDir);
      for (const file of await tfs.list(template)) {
        if (file === `${template}/template.json`) continue;
        await target.writeBytes(file.slice(template.length + 1), await tfs.readBytes(file));
      }
      return await group.openProject(root);
    },
  };
  return group;
}
