import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { NOT_EFFECTIVE_TEXT } from "../../src/ui/state/write-actions.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, StyleChange, WriteResult } from "../../src/contracts/model.ts";

const ok = (revision: number, message = "Saved to styles.css", effective = true): WriteResult => ({ files: ["styles.css"], revision, effective, path: null, message });
const tree = { tag: "body" } as ElementNode;

describe("write actions", () => {
  it("applies a style to the selection at the current scope", async () => {
    const seen: StyleChange[] = [];
    const { client } = createFakeClient({ applyStyle: async (c) => { seen.push(c); return ok(1); }, pageTree: async () => tree });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1.0.0.1", scope: "tablet" });
    await store.actions.applyStyle("font-size", "30px");
    expect(seen).toEqual([{ page: "Home", path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" }]);
    expect(store.getState()).toMatchObject({ revision: 1, toast: { tone: "success", text: "Saved to styles.css", undo: true } });
  });
  it("warns when the saved value does not win", async () => {
    const store = createStudioStore(createFakeClient({ applyStyle: async () => ok(2, "Saved to styles.css", false), pageTree: async () => tree }).client);
    store.setState({ page: "Home", selection: "0" });
    await store.actions.applyStyle("color", "red");
    expect(store.getState().toast).toMatchObject({ tone: "info", text: NOT_EFFECTIVE_TEXT });
  });
  it("does nothing without a selection", async () => {
    let calls = 0;
    const store = createStudioStore(createFakeClient({ applyStyle: async () => { calls += 1; return ok(1); } }).client);
    store.setState({ page: "Home" });
    await store.actions.applyStyle("color", "red");
    expect(calls).toBe(0);
  });
  it("resets, undoes and redoes through the client", async () => {
    const calls: unknown[][] = [];
    const { client } = createFakeClient({
      resetStyle: async (...a) => { calls.push(["reset", ...a]); return ok(3); },
      undo: async () => { calls.push(["undo"]); return ok(4, "Undid: Saved to styles.css"); },
      redo: async () => { calls.push(["redo"]); return ok(5, "Redid: Saved to styles.css"); },
      pageTree: async () => tree,
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home", selection: "1", scope: "mobile" });
    await store.actions.resetStyle("font-size");
    await store.actions.undo();
    await store.actions.redo();
    expect(calls).toEqual([["reset", "Home", "1", "font-size", "mobile"], ["undo"], ["redo"]]);
    expect(store.getState()).toMatchObject({ revision: 5, toast: { text: "Redid: Saved to styles.css" } });
  });
});
