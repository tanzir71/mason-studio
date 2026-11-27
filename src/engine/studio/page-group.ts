import { MasonError } from "../../contracts/errors.ts";
import type { CssSheet, PageInfo } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { requireFs, requireProject } from "./context.ts";
import { scanPages } from "./project-group.ts";
import type { EngineContext } from "./context.ts";
import { parsePage } from "../html/parse.ts";
import { parseStylesheet } from "../css/parse.ts";

export interface LoadedPage { info: PageInfo; html: string; model: PageModel; sheets: CssSheet[] }

/** Loads one page of the open project: its info, HTML, parsed model and the stylesheets that exist. */
export async function loadPage(ctx: EngineContext, name: string): Promise<LoadedPage> {
  const project = requireProject(ctx);
  const fs = requireFs(ctx);
  const info = project.pages.find((p) => p.name === name);
  if (!info) throw new MasonError("PAGE_NOT_FOUND", name);
  const html = await fs.readText(info.file);
  const model = parsePage(info.file, html);
  const sheets: CssSheet[] = [];
  for (const href of model.stylesheets) {
    if (await fs.exists(href)) sheets.push(parseStylesheet(href, await fs.readText(href)));
  }
  return { info, html, model, sheets };
}

/** "About us!" → "about-us": lowercase, runs of characters outside a-z and 0-9 → "-", trim "-". */
export function pageSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createPageGroup(ctx: EngineContext): Pick<StudioService, "pageTree" | "createPage"> {
  return {
    async pageTree(page) { return (await loadPage(ctx, page)).model.body; },
    async createPage(name) {
      const project = requireProject(ctx); const fs = requireFs(ctx);
      const slug = pageSlug(name);
      if (slug === "") throw new MasonError("INVALID_INPUT", name);
      const file = `${slug}.html`;
      if (await fs.exists(file)) throw new MasonError("PAGE_EXISTS", file);
      const first = await fs.readText(project.pages[0].file);
      const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(first)?.[1] ?? "\n  <meta charset=\"utf-8\">\n  <title></title>\n";
      const title = `<title>${escapeHtml(name.trim())}</title>`;
      const newHead = /<title>[\s\S]*?<\/title>/i.test(head) ? head.replace(/<title>[\s\S]*?<\/title>/i, title) : head + `  ${title}\n`;
      await fs.writeText(file, `<!doctype html>\n<html lang="en">\n<head>${newHead}</head>\n<body>\n  <main></main>\n</body>\n</html>\n`);
      const pages = await scanPages(fs);
      ctx.project = { ...project, pages };
      return pages.find((p) => p.file === file)!;
    },
  };
}
