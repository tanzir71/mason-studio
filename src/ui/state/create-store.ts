import { INITIAL_STATE } from "../../contracts/ui.tsx";
import type { CreateStudioStore, StudioActions, StudioState, StudioStore } from "../../contracts/ui.tsx";
import { createStoreContext, STORE_ACTION_NAMES } from "./store-context.ts";
import { createProjectActions } from "./project-actions.ts";
import { createViewActions } from "./view-actions.ts";
import { createEventActions } from "./event-actions.ts";
import { createWriteActions } from "./write-actions.ts";
import { createElementActions } from "./element-actions.ts";
import { createAssetActions } from "./asset-actions.ts";
// @seam:imports

export const createStudioStore: CreateStudioStore = (client) => {
  let state: StudioState = INITIAL_STATE;
  const listeners = new Set<() => void>();
  const actions = {} as StudioActions;
  const store: StudioStore = {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      for (const l of [...listeners]) l();
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    actions,
  };
  const ctx = createStoreContext(client, store);
  for (const name of STORE_ACTION_NAMES) {
    (actions as unknown as Record<string, unknown>)[name] = () => {
      ctx.toast("info", `${name} is not available yet.`, false);
      return Promise.resolve();
    };
  }
  Object.assign(actions, createProjectActions(ctx));
  Object.assign(actions, createViewActions(ctx));
  Object.assign(actions, createEventActions(ctx));
  Object.assign(actions, createWriteActions(ctx));
  Object.assign(actions, createElementActions(ctx));
  Object.assign(actions, createAssetActions(ctx));
  // @seam:slices
  return store;
};
