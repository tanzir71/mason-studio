import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { ProjectInfo } from "../../contracts/model.ts";
import type { StoreContext } from "./store-context.ts";

/** Switches to the canvas for `project`: first page, its tree, then git, tokens and proposals (each optional). */
export async function enterProject(ctx: StoreContext, project: ProjectInfo): Promise<void> {
  const page = project.pages[0]?.name ?? null;
  ctx.set({
    screen: "canvas", project, page, tree: null, selection: null, hover: null, inspect: null, checks: null,
    contrast: [], code: INITIAL_STATE.code, scope: "all", activeBoard: "desktop", tool: "move",
  });
  if (page) ctx.set({ tree: await ctx.client.pageTree(page) });
  const [git, tokens, proposals] = await Promise.all([
    ctx.client.gitStatus().catch(() => null),
    ctx.client.tokens().catch(() => null),
    ctx.client.proposals().catch(() => []),
  ]);
  ctx.set({ git, tokens, proposals });
}

export function createProjectActions(ctx: StoreContext): Pick<StudioActions,
  "init" | "openProject" | "createProject" | "closeProject" | "selectPage" | "createPage"> {
  const { client } = ctx;
  return {
    init: () => ctx.run(async () => {
      const [recent, templates, settings] = await Promise.all([
        client.recentProjects().catch(() => []),
        client.templates().catch(() => []),
        client.settings().catch(() => null),
      ]);
      ctx.set({ recent, templates, settings });
      let project: ProjectInfo;
      try { project = await client.currentProject(); } catch { return; }
      await enterProject(ctx, project);
    }),
    openProject: (root) => ctx.run(async () => { await enterProject(ctx, await client.openProject(root)); }),
    createProject: (root, template) => ctx.run(async () => { await enterProject(ctx, await client.createProject(root, template)); }),
    closeProject() {
      ctx.set({ screen: "start", project: null, page: null, tree: null, selection: null, hover: null, inspect: null, checks: null, contrast: [] });
      client.recentProjects().then((recent) => ctx.set({ recent })).catch(() => {});
    },
    selectPage: (name) => ctx.run(async () => {
      ctx.set({ page: name, tree: null, selection: null, hover: null, inspect: null, checks: null, contrast: [] });
      const tree = await client.pageTree(name);
      if (ctx.get().page === name) ctx.set({ tree });
    }),
    createPage: (name) => ctx.run(async () => {
      const info = await client.createPage(name);
      ctx.set({ project: await client.currentProject() });
      await ctx.actions.selectPage(info.name);
    }),
  };
}
