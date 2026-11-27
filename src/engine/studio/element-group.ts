import type { StudioService } from "../../contracts/ports.ts";
import { planEditText, planRemoveElement } from "../html/edit.ts";
import { planInsertElement, planMoveElement, planWrapInStack } from "../html/structure.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import type { LoadedPage } from "./page-group.ts";
import { writeEdits } from "./write.ts";

/** { file, text } of the page's last linked stylesheet ("" when the file does not exist yet), or null without one. */
export async function pageCss(ctx: EngineContext, lp: LoadedPage): Promise<{ file: string; text: string } | null> {
  const file = lp.model.stylesheets[lp.model.stylesheets.length - 1];
  if (!file) return null;
  const fs = requireFs(ctx);
  return { file, text: (await fs.exists(file)) ? await fs.readText(file) : "" };
}

export function createElementGroup(ctx: EngineContext): Pick<StudioService,
  "insertElement" | "editText" | "removeElement" | "moveElement" | "wrapInStack"> {
  return {
    async insertElement(page, parentPath, index, kind) {
      const lp = await loadPage(ctx, page);
      const plan = planInsertElement(lp.model, lp.html, await pageCss(ctx, lp), parentPath, index, kind);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
    async editText(page, path, text) {
      const lp = await loadPage(ctx, page);
      return writeEdits(ctx, planEditText(lp.model, path, text), { path });
    },
    async removeElement(page, path) {
      const lp = await loadPage(ctx, page);
      return writeEdits(ctx, planRemoveElement(lp.model, lp.html, path));
    },
    async moveElement(page, path, toIndex) {
      const lp = await loadPage(ctx, page);
      const plan = planMoveElement(lp.model, lp.html, path, toIndex);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
    async wrapInStack(page, path) {
      const lp = await loadPage(ctx, page);
      const plan = planWrapInStack(lp.model, lp.html, await pageCss(ctx, lp), path);
      return writeEdits(ctx, plan.edits, { path: plan.path });
    },
  };
}
