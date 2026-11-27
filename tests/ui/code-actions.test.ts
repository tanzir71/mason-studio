import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode } from "../../src/contracts/model.ts";

describe("code actions", () => {
  it("opens, edits, saves and closes a file", async () => {
    const writes: unknown[][] = [];
    const { client } = createFakeClient({
      readFile: async (path) => ({ path, text: "a {}\n" }),
      writeFile: async (...a) => { writes.push(a); return { files: ["styles.css"], revision: 2, effective: true, path: null, message: "Saved to styles.css" }; },
      pageTree: async () => ({ tag: "body" } as ElementNode),
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home" });
    await store.actions.openCode("styles.css", 22);
    expect(store.getState().code).toEqual({ open: true, file: "styles.css", line: 22, text: "a {}\n", dirty: false });
    store.actions.editCode("b {}\n");
    expect(store.getState().code).toMatchObject({ text: "b {}\n", dirty: true });
    await store.actions.saveCode();
    expect(writes).toEqual([["styles.css", "b {}\n"]]);
    expect(store.getState().code.dirty).toBe(false);
    expect(store.getState().revision).toBe(2);
    store.actions.closeCode();
    expect(store.getState().code).toEqual({ open: false, file: null, line: null, text: null, dirty: false });
  });
  it("does not save a clean file", async () => {
    let writes = 0;
    const store = createStudioStore(createFakeClient({ writeFile: async () => { writes += 1; throw new Error("x"); } }).client);
    store.setState({ code: { open: true, file: "a.css", line: null, text: "a", dirty: false } });
    await store.actions.saveCode();
    expect(writes).toBe(0);
  });
  it("shows an error toast when the file cannot be read", async () => {
    const store = createStudioStore(createFakeClient().client);
    await store.actions.openCode("x.css", null);
    expect(store.getState().code.open).toBe(false);
    expect(store.getState().toast).toMatchObject({ tone: "error" });
  });
});
