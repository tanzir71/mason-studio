import type { StudioState, StudioStore, MasonClient, StudioActions, Toast } from "../../contracts/ui.tsx";
import type { WriteResult } from "../../contracts/model.ts";

/** Every StudioActions name. create-store.ts fills each with a placeholder before the slices are assigned. */
export const STORE_ACTION_NAMES = [
  "init", "openProject", "createProject", "closeProject", "selectPage", "createPage", "select", "hover", "setScope",
  "setActiveBoard", "setTool", "setLeftTab", "setRightTab", "setZoom", "panBy", "applyStyle", "resetStyle",
  "insertElement", "editText", "removeSelected", "moveElement", "wrapSelected", "undo", "redo", "loadTokens",
  "importTokens", "exportTokens", "runChecks", "setContrast", "openCode", "editCode", "saveCode", "closeCode",
  "refreshGit", "commit", "openAgentPrompt", "closeAgentPrompt", "askAgent", "loadProposals", "acceptProposal",
  "rejectProposal", "openSettings", "closeSettings", "saveSettings", "handleEvent", "showToast", "dismissToast",
] as const satisfies readonly (keyof StudioActions)[];

/** What every action slice receives. */
export interface StoreContext {
  client: MasonClient;
  get(): StudioState;
  set(patch: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)): void;
  /** The store's full actions object; slices call each other through it. */
  actions: StudioActions;
  /** toast = { id: (previous toast id, or 0) + 1, tone, text, undo }. */
  toast(tone: Toast["tone"], text: string, undo: boolean): void;
  /** Awaits fn; any thrown error becomes toast("error", message, false). Never rejects. */
  run(fn: () => Promise<void>): Promise<void>;
  /** busy = true; result = await fn(); afterWrite(result); returns result. Errors → error toast, busy = false, returns null. */
  write(fn: () => Promise<WriteResult>): Promise<WriteResult | null>;
  /** revision = result.revision, busy = false, toast("success", result.message, true), then reloadPage(). */
  afterWrite(result: WriteResult): Promise<void>;
  /** Starts refreshGit(); with a page open: tree = pageTree(page); with a selection: inspect = inspect(page, selection), or null when that fails. */
  reloadPage(): Promise<void>;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createStoreContext(client: MasonClient, store: StudioStore): StoreContext {
  let toastId = 0;
  const ctx: StoreContext = {
    client,
    get: () => store.getState(),
    set: (patch) => store.setState(patch),
    actions: store.actions,
    toast(tone, text, undo) {
      toastId = Math.max(toastId, store.getState().toast?.id ?? 0) + 1;
      store.setState({ toast: { id: toastId, tone, text, undo } });
    },
    async run(fn) {
      try { await fn(); } catch (error) { ctx.toast("error", messageOf(error), false); }
    },
    async write(fn) {
      store.setState({ busy: true });
      try {
        const result = await fn();
        await ctx.afterWrite(result);
        return result;
      } catch (error) {
        store.setState({ busy: false });
        ctx.toast("error", messageOf(error), false);
        return null;
      }
    },
    async afterWrite(result) {
      store.setState({ revision: result.revision, busy: false });
      ctx.toast("success", result.message, true);
      await ctx.reloadPage();
    },
    async reloadPage() {
      void store.actions.refreshGit();
      const { page } = store.getState();
      if (!page) return;
      const tree = await client.pageTree(page);
      if (store.getState().page !== page) return;
      store.setState({ tree });
      const selection = store.getState().selection;
      if (selection === null) return;
      try {
        const inspect = await client.inspect(page, selection);
        if (store.getState().selection === selection) store.setState({ inspect });
      } catch {
        store.setState({ inspect: null });
      }
    },
  };
  return ctx;
}
