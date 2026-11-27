import { useEffect } from "react";
import { SHORTCUTS } from "../../contracts/ui.tsx";
import type { ShortcutAction, StudioStore } from "../../contracts/ui.tsx";
import { fitZoom } from "../canvas/tools.ts";

export interface KeyLike { key: string; code?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

/** "shift", then "mod" (Cmd on macOS, Ctrl elsewhere), then the lowercase key; Digit codes give the digit (shift+1). */
export function comboOf(e: KeyLike, isMac: boolean): string {
  const parts: string[] = [];
  if (e.shiftKey) parts.push("shift");
  if (isMac ? e.metaKey : e.ctrlKey) parts.push("mod");
  const digit = /^Digit(\d)$/.exec(e.code ?? "");
  parts.push(digit ? digit[1] : e.key.toLowerCase());
  return parts.join("+");
}

/** The shortcut action for a key event, or null. Alt combinations never match. */
export function matchShortcut(e: KeyLike, isMac: boolean): ShortcutAction | null {
  if (e.altKey) return null;
  const combo = comboOf(e, isMac);
  return SHORTCUTS.find((s) => s.keys === combo)?.action ?? null;
}

/** Runs one shortcut action against the store. */
export function runShortcut(action: ShortcutAction, store: StudioStore, viewportWidth: number): void {
  const { actions } = store;
  const state = store.getState();
  if (action.startsWith("tool:")) { actions.setTool(action.slice(5) as Parameters<typeof actions.setTool>[0]); return; }
  switch (action) {
    case "wrap": if (state.selection) void actions.wrapSelected(); break;
    case "agent": actions.openAgentPrompt(); break;
    case "code": {
      const info = state.project?.pages.find((p) => p.name === state.page);
      if (info) void actions.openCode(info.file, null);
      break;
    }
    case "undo": void actions.undo(); break;
    case "redo": void actions.redo(); break;
    case "delete": if (state.selection) void actions.removeSelected(); break;
    case "deselect": actions.select(null); break;
    case "zoom:fit": actions.setZoom(fitZoom(viewportWidth)); break;
    case "zoom:in": actions.setZoom(state.zoom + 0.1); break;
    case "zoom:out": actions.setZoom(state.zoom - 0.1); break;
  }
}

/** True when the key event comes from a text input, textarea, select or editable content. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable === true;
}

/** Window keydown listener: matched shortcuts run and the default action is prevented. */
export function useShortcuts(store: StudioStore): void {
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (store.getState().screen !== "canvas") return;
      const action = matchShortcut(e, isMac);
      if (!action) return;
      e.preventDefault();
      runShortcut(action, store, window.innerWidth - 520);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
}
