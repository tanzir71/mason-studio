import { describe, expect, it, vi } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, Proposal } from "../../src/contracts/model.ts";

const proposal = (id: string, summary: string) => ({ id, summary } as Proposal);

describe("event actions", () => {
  it("reloads the tree for a written event from another client", async () => {
    let loads = 0;
    const store = createStudioStore(createFakeClient({ pageTree: async () => { loads += 1; return { tag: "body" } as ElementNode; } }).client);
    store.setState({ page: "Home", revision: 2 });
    store.actions.handleEvent({ type: "written", files: ["a.css"], revision: 2 });
    expect(loads).toBe(0);
    store.actions.handleEvent({ type: "written", files: ["a.css"], revision: 3 });
    expect(store.getState().revision).toBe(3);
    await vi.waitFor(() => expect(loads).toBe(1));
  });
  it("bumps the revision on external changes", () => {
    const store = createStudioStore(createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) }).client);
    store.setState({ page: "Home", revision: 5 });
    store.actions.handleEvent({ type: "external-change", files: ["index.html"] });
    expect(store.getState().revision).toBe(6);
  });
  it("puts proposals first and replaces them by id", () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ proposals: [proposal("a", "old"), proposal("b", "b")] });
    store.actions.handleEvent({ type: "proposal", proposal: proposal("a", "new") });
    expect(store.getState().proposals.map((p) => [p.id, p.summary])).toEqual([["a", "new"], ["b", "b"]]);
  });
  it("shows and dismisses toasts", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.showToast("info", "Hello", false);
    store.actions.showToast("success", "Saved", true);
    expect(store.getState().toast).toEqual({ id: 2, tone: "success", text: "Saved", undo: true });
    store.actions.dismissToast();
    expect(store.getState().toast).toBeNull();
  });
});
