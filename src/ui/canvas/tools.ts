import type { BreakpointId, ElementNode, ElementPath, InsertKind } from "../../contracts/model.ts";
import type { StudioActions, StudioState } from "../../contracts/ui.tsx";
import { pathOf } from "./dom-paths.ts";
import { nodeAt } from "../panels/design-fields.ts";

export const INSERT_TOOLS: readonly InsertKind[] = ["frame", "rect", "ellipse", "text", "image"];

/**
 * Where an insert tool click puts the new element: inside a frame/stack (appended last; the body when path is null),
 * else right after the clicked element in its parent.
 */
export function insertTarget(tree: ElementNode, path: ElementPath | null): { parentPath: ElementPath; index: number } {
  const node = path === null ? tree : nodeAt(tree, path) ?? tree;
  if (node.path === "" || node.kind === "frame" || node.kind === "stack") return { parentPath: node.path, index: node.children.length };
  const dot = node.path.lastIndexOf(".");
  return { parentPath: dot === -1 ? "" : node.path.slice(0, dot), index: Number(node.path.slice(dot + 1)) + 1 };
}

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

/**
 * Pointer down on a board. Another page → selectPage. Move tool → activate the board and select the path.
 * Insert tools → insertElement(tool, insertTarget(tree, path)).
 */
export function boardPointerDown(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page !== p.page) { void actions.selectPage(p.page); return; }
  if (state.tool === "move") {
    if (state.activeBoard !== p.board) actions.setActiveBoard(p.board);
    actions.select(p.path);
    return;
  }
  const kind = INSERT_TOOLS.find((k) => k === state.tool);
  if (kind && state.tree) {
    const target = insertTarget(state.tree, p.path);
    void actions.insertElement(kind, target.parentPath, target.index);
  }
}

/** Double click on a board with the move tool: the text/link path to edit, or null. */
export function editablePath(state: StudioState, p: BoardPointer): ElementPath | null {
  if (state.page !== p.page || state.tool !== "move" || p.path === null || !state.tree) return null;
  const node = nodeAt(state.tree, p.path);
  return node && (node.kind === "text" || node.kind === "link") ? node.path : null;
}

/** Pointer move on a board: hover follows the pointer with the move tool on the open page. */
export function boardPointerMove(state: StudioState, actions: StudioActions, p: BoardPointer): void {
  if (state.page === p.page && state.tool === "move") actions.hover(p.path);
}
