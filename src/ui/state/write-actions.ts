import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export const NOT_EFFECTIVE_TEXT = "Saved, but another rule still wins at this size.";

export function createWriteActions(ctx: StoreContext): Pick<StudioActions, "applyStyle" | "resetStyle" | "undo" | "redo"> {
  const { client } = ctx;
  return {
    async applyStyle(prop, value) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      const result = await ctx.write(() => client.applyStyle({ page, path: selection, prop, value, scope }));
      if (result && !result.effective) ctx.toast("info", NOT_EFFECTIVE_TEXT, true);
    },
    async resetStyle(prop) {
      const { page, selection, scope } = ctx.get();
      if (page === null || selection === null) return;
      await ctx.write(() => client.resetStyle(page, selection, prop, scope));
    },
    async undo() { await ctx.write(() => client.undo()); },
    async redo() { await ctx.write(() => client.redo()); },
  };
}
