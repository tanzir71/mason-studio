import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export function createElementActions(ctx: StoreContext): Pick<StudioActions,
  "insertElement" | "editText" | "removeSelected" | "moveElement" | "wrapSelected"> {
  const { client } = ctx;
  return {
    async insertElement(kind, parentPath, index) {
      const page = ctx.get().page;
      ctx.set({ tool: "move" });
      if (page === null) return;
      const result = await ctx.write(() => client.insertElement(page, parentPath, index, kind));
      if (result?.path != null) ctx.actions.select(result.path);
    },
    async editText(path, text) {
      const page = ctx.get().page;
      if (page === null) return;
      await ctx.write(() => client.editText(page, path, text));
    },
    async removeSelected() {
      const { page, selection } = ctx.get();
      if (page === null || selection === null || selection === "") return;
      const result = await ctx.write(() => client.removeElement(page, selection));
      if (result) ctx.set({ selection: null, hover: null, inspect: null });
    },
    async moveElement(path, toIndex) {
      const page = ctx.get().page;
      if (page === null) return;
      const result = await ctx.write(() => client.moveElement(page, path, toIndex));
      if (result?.path != null) ctx.actions.select(result.path);
    },
    async wrapSelected() {
      const { page, selection } = ctx.get();
      if (page === null || selection === null || selection === "") return;
      const result = await ctx.write(() => client.wrapInStack(page, selection));
      if (result?.path != null) ctx.actions.select(result.path);
    },
  };
}
