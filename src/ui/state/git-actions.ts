import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createGitActions(ctx: StoreContext): Pick<StudioActions, "refreshGit" | "commit"> {
  return {
    /** Background refresh: on failure the last status stays and no toast is shown. */
    async refreshGit() {
      try { ctx.set({ git: await ctx.client.gitStatus() }); } catch { /* keep the last status */ }
    },
    commit: (message) => ctx.run(async () => {
      const git = await ctx.client.commit(message);
      ctx.set({ git });
      ctx.toast("success", "Committed", false);
    }),
  };
}
