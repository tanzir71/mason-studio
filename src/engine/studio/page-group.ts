import { MasonError } from "../../contracts/errors.ts";
import type { CssSheet, PageInfo } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { requireFs, requireProject } from "./context.ts";
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

export function createPageGroup(ctx: EngineContext): Pick<StudioService, "pageTree"> {
  return {
    async pageTree(page: string) {
      return (await loadPage(ctx, page)).model.body;
    },
  };
}
