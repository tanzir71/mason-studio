import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, WriteResult } from "../../src/contracts/model.ts";

const ok = (path: string | null): WriteResult => ({ files: ["index.html"], revision: 1, effective: true, path, message: "Saved to index.html" });
const tree = { tag: "body" } as ElementNode;

describe("element actions", () => {
  it("inserts, selects the new element and returns to the move tool", async () => {
    const calls: unknown[][] = [];
    const { client } = createFakeClient({ insertElement: async (...a) => { calls.push(a); return ok("1.0.4"); }, pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", tool: "rect" });
    await store.actions.insertElement("rect", "1.0", 4);
    expect(calls).toEqual([["Home", "1.0", 4, "rect"]]);
    expect(store.getState()).toMatchObject({ tool: "move", selection: "1.0.4" });
  });
  it("removes the selection and clears it", async () => {
    const { client } = createFakeClient({ removeElement: async () => ok(null), pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "2" });
    await store.actions.removeSelected();
    expect(store.getState().selection).toBeNull();
  });
  it("never removes or wraps the body", async () => {
    let calls = 0;
    const { client } = createFakeClient({ removeElement: async () => { calls += 1; return ok(null); }, wrapInStack: async () => { calls += 1; return ok(""); } });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "" });
    await store.actions.removeSelected();
    await store.actions.wrapSelected();
    expect(calls).toBe(0);
  });
  it("moves and wraps, selecting the result path", async () => {
    const { client } = createFakeClient({ moveElement: async () => ok("1.2"), wrapInStack: async () => ok("1.2"), editText: async () => ok("1.0"), pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1.0" });
    await store.actions.moveElement("1.0", 2);
    expect(store.getState().selection).toBe("1.2");
    await store.actions.wrapSelected();
    await store.actions.editText("1.2", "Hi");
    expect(store.getState().toast).toMatchObject({ text: "Saved to index.html" });
  });
});
