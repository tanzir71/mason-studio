import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createCheckActions(ctx: StoreContext): Pick<StudioActions, "runChecks" | "setContrast"> {
  return {
    runChecks: () => ctx.run(async () => {
      const page = ctx.get().page;
      if (page === null) return;
      const checks = await ctx.client.checks(page);
      if (ctx.get().page === page) ctx.set({ checks });
    }),
    setContrast(contrast) { ctx.set({ contrast }); },
  };
}
