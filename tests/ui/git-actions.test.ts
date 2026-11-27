import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createStoreContext } from "../../src/ui/state/store-context.ts";
import { createFakeClient, createFakeStore } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, GitStatus } from "../../src/contracts/model.ts";

const status: GitStatus = { isRepo: true, branch: "main", changes: 2, files: ["a.css", "b.html"] };

describe("git actions", () => {
  it("refreshes quietly and keeps the last status on failure", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ git: status });
    await store.actions.refreshGit();
    expect([store.getState().git, store.getState().toast]).toEqual([status, null]);
  });
  it("commits and stores the new status", async () => {
    const messages: string[] = [];
    const store = createStudioStore(createFakeClient({ commit: async (m) => { messages.push(m); return { ...status, changes: 0, files: [] }; } }).client);
    await store.actions.commit("Tighter headline");
    expect(messages).toEqual(["Tighter headline"]);
    expect(store.getState()).toMatchObject({ git: { changes: 0 }, toast: { tone: "success", text: "Committed" } });
  });
  it("refreshes git whenever the page reloads", async () => {
    const store = createFakeStore({ page: "Home" });
    await createStoreContext(createFakeClient({ pageTree: async () => ({ tag: "body" } as ElementNode) }).client, store).reloadPage();
    expect(store.calls.map((c) => c.name)).toEqual(["refreshGit"]);
  });
});
