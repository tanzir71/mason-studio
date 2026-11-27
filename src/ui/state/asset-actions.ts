import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createAssetActions(ctx: StoreContext): Pick<StudioActions, "loadTokens" | "importTokens" | "exportTokens"> {
  const { client } = ctx;
  return {
    loadTokens: () => ctx.run(async () => { ctx.set({ tokens: await client.tokens() }); }),
    importTokens: (format, json) => ctx.run(async () => {
      const tokens = await client.importTokens(format, json);
      ctx.set({ tokens });
      ctx.toast("success", `Imported ${tokens.tokens.length} tokens`, true);
    }),
    exportTokens: () => ctx.run(async () => {
      const result = await client.exportTokens();
      if (result.files.length === 0) { ctx.toast("info", result.message, false); return; }
      await ctx.afterWrite(result);
    }),
  };
}
