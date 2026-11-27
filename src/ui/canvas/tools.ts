import type { BreakpointId, ElementPath } from "../../contracts/model.ts";
import type { StudioActions, StudioState } from "../../contracts/ui.tsx";
import { pathOf } from "./dom-paths.ts";

/** Width of one page row at zoom 1: the three boards plus two 48px gaps plus 48px padding on both sides. */
export const ROW_WIDTH = 1280 + 768 + 375 + 2 * 48 + 2 * 48;
/** Zoom that fits a page row into `width` pixels, clamped to [0.1, 2], 2 decimals. */
export function fitZoom(width: number): number {
  return Math.round(Math.min(2, Math.max(0.1, width / ROW_WIDTH)) * 100) / 100;
}

/** Element path under a pointer event on a board's hit layer, or null. */
export function pathAtPoint(frame: HTMLIFrameElement | null, hit: HTMLElement, clientX: number, clientY: number, zoom: number): ElementPath | null {
  const doc = frame?.contentDocument;
  if (!doc) return null;
  const r = hit.getBoundingClientRect();
  const el = doc.elementFromPoint((clientX - r.left) / zoom, (clientY - r.top) / zoom);
  return el ? pathOf(el) : null;
}

export interface BoardPointer { page: string; board: BreakpointId; path: ElementPath | null }

/** Pointer down on a board. Another page → selectPage. Move tool → activate the board and select the path. */
export function boardPointerDown(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page !== p.page) { void actions.selectPage(p.page); return; }
  if (state.tool === "move") {
    if (state.activeBoard !== p.board) actions.setActiveBoard(p.board);
    actions.select(p.path);
  }
}

/** Pointer move on a board: hover follows the pointer with the move tool on the open page. */
export function boardPointerMove(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page === p.page && state.tool === "move") actions.hover(p.path);
}
