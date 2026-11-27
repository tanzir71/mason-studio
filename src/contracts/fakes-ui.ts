/** UI fakes. Planner-owned (protected): never edit. Used by UI tests only. */
import type { MasonEvent } from "./model.ts";
import type { StudioService } from "./ports.ts";
import { createFakeStudio } from "./fakes.ts";
import { INITIAL_STATE } from "./ui.tsx";
import type { MasonClient, StudioActions, StudioState, StudioStore } from "./ui.tsx";

export const ACTION_NAMES = [
  "init", "openProject", "createProject", "closeProject", "selectPage", "createPage", "select", "hover", "setScope",
  "setActiveBoard", "setTool", "setLeftTab", "setRightTab", "setZoom", "panBy", "applyStyle", "resetStyle",
  "insertElement", "editText", "removeSelected", "moveElement", "wrapSelected", "undo", "redo", "loadTokens",
  "importTokens", "exportTokens", "runChecks", "setContrast", "openCode", "editCode", "saveCode", "closeCode",
  "refreshGit", "commit", "openAgentPrompt", "closeAgentPrompt", "askAgent", "loadProposals", "acceptProposal",
  "rejectProposal", "openSettings", "closeSettings", "saveSettings", "handleEvent", "showToast", "dismissToast",
] as const satisfies readonly (keyof StudioActions)[];

/** A MasonClient over createFakeStudio(overrides); `emit` pushes an event to every subscriber. */
export function createFakeClient(overrides: Partial<StudioService> = {}): { client: MasonClient; emit(e: MasonEvent): void } {
  const listeners = new Set<(e: MasonEvent) => void>();
  const client = Object.assign(createFakeStudio(overrides), {
    subscribe(l: (e: MasonEvent) => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  }) as MasonClient;
  return { client, emit(e) { for (const l of listeners) l(e); } };
}

export interface FakeStore extends StudioStore { calls: { name: keyof StudioActions; args: unknown[] }[] }
/** A store with INITIAL_STATE merged with `state`. Every action only records { name, args } in `calls` (async ones resolve). */
export function createFakeStore(state: Partial<StudioState> = {}): FakeStore {
  let current: StudioState = { ...INITIAL_STATE, ...state };
  const listeners = new Set<() => void>();
  const calls: FakeStore["calls"] = [];
  const actions = {} as Record<string, unknown>;
  for (const name of ACTION_NAMES) actions[name] = (...args: unknown[]) => { calls.push({ name, args }); return Promise.resolve(); };
  return {
    calls,
    getState: () => current,
    setState(patch) { current = { ...current, ...(typeof patch === "function" ? patch(current) : patch) }; for (const l of listeners) l(); },
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    actions: actions as unknown as StudioActions,
  };
}
