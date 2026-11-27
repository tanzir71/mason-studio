import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createCodeActions(ctx: StoreContext): Pick<StudioActions, "openCode" | "editCode" | "saveCode" | "closeCode"> {
  const { client } = ctx;
  return {
    openCode: (file, line) => ctx.run(async () => {
      const { path, text } = await client.readFile(file);
      ctx.set({ code: { open: true, file: path, line, text, dirty: false } });
    }),
    editCode(text) {
      ctx.set((s) => ({ code: { ...s.code, text, dirty: true } }));
    },
    async saveCode() {
      const { file, text, dirty } = ctx.get().code;
      if (!file || text === null || !dirty) return;
      const result = await ctx.write(() => client.writeFile(file, text));
      if (result && ctx.get().code.file === file) ctx.set((s) => ({ code: { ...s.code, dirty: s.code.text !== text } }));
    },
    closeCode() {
      ctx.set({ code: INITIAL_STATE.code });
    },
  };
}
