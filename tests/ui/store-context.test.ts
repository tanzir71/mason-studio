import { describe, expect, it } from "vitest";
import { createStoreContext } from "../../src/ui/state/store-context.ts";
import { createFakeClient, createFakeStore } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, InspectResult, WriteResult } from "../../src/contracts/model.ts";

const result: WriteResult = { files: ["styles.css"], revision: 4, effective: true, path: null, message: "Saved to styles.css" };

describe("store context", () => {
  it("numbers toasts from the previous id", () => {
    const store = createFakeStore({ toast: { id: 7, tone: "info", text: "x", undo: false } });
    const ctx = createStoreContext(createFakeClient().client, store);
    ctx.toast("success", "Saved", true);
    expect(store.getState().toast).toEqual({ id: 8, tone: "success", text: "Saved", undo: true });
  });
  it("write applies the result, toasts and reloads tree and inspect", async () => {
    const { client } = createFakeClient({
      pageTree: async () => ({ tag: "body" } as ElementNode),
      inspect: async (_p, path) => ({ path } as InspectResult),
    });
    const store = createFakeStore({ page: "Home", selection: "1.0" });
    const ctx = createStoreContext(client, store);
    const r = await ctx.write(async () => result);
    expect(r).toBe(result);
    expect(store.getState()).toMatchObject({ revision: 4, busy: false, toast: { tone: "success", text: "Saved to styles.css", undo: true }, tree: { tag: "body" }, inspect: { path: "1.0" } });
  });
  it("write turns a failure into an error toast and returns null", async () => {
    const store = createFakeStore({ page: "Home" });
    const ctx = createStoreContext(createFakeClient().client, store);
    expect(await ctx.write(async () => { throw new Error("nope"); })).toBeNull();
    expect(store.getState()).toMatchObject({ busy: false, toast: { tone: "error", text: "nope", undo: false } });
  });
  it("reloadPage sets inspect to null when inspect fails", async () => {
    const { client } = createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) });
    const store = createFakeStore({ page: "Home", selection: "9", inspect: { path: "9" } as InspectResult });
    await createStoreContext(client, store).reloadPage();
    expect(store.getState().inspect).toBeNull();
  });
});
