import { SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { StudioActions } from "../../contracts/ui.tsx";
import type { StoreContext } from "./store-context.ts";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
/** Clamp to [0.1, 2] and round to 2 decimals. */
export function clampZoom(zoom: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100;
}

export function createViewActions(ctx: StoreContext): Pick<StudioActions,
  "select" | "hover" | "setScope" | "setActiveBoard" | "setTool" | "setLeftTab" | "setRightTab" | "setZoom" | "panBy"> {
  return {
    select(path) {
      ctx.set({ selection: path, inspect: null });
      const page = ctx.get().page;
      if (path === null || page === null) return;
      ctx.client.inspect(page, path)
        .then((inspect) => { if (ctx.get().selection === path && ctx.get().page === page) ctx.set({ inspect }); })
        .catch(() => {});
    },
    hover(path) { if (ctx.get().hover !== path) ctx.set({ hover: path }); },
    setScope(scope) { ctx.set({ scope, activeBoard: SCOPE_BREAKPOINT[scope] }); },
    setActiveBoard(id) { ctx.set({ activeBoard: id, scope: id === "desktop" ? "all" : id }); },
    setTool(tool) { ctx.set({ tool }); },
    setLeftTab(leftTab) { ctx.set({ leftTab }); },
    setRightTab(rightTab) { ctx.set({ rightTab }); },
    setZoom(zoom) { ctx.set({ zoom: clampZoom(zoom) }); },
    panBy(dx, dy) { ctx.set((s) => ({ pan: { x: s.pan.x + dx, y: s.pan.y + dy } })); },
  };
}
