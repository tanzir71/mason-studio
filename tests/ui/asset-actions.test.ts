import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { ElementNode, TokenSet } from "../../src/contracts/model.ts";

const set: TokenSet = { file: "tokens.json", tokens: [{ name: "color.ink", type: "color", value: "#1e2a22", alias: null, byBreakpoint: {} }] };

describe("asset actions", () => {
  it("loads and imports tokens", async () => {
    const seen: unknown[][] = [];
    const store = createStudioStore(createFakeClient({ tokens: async () => set, importTokens: async (...a) => { seen.push(a); return set; } }).client);
    await store.actions.loadTokens();
    expect(store.getState().tokens).toBe(set);
    await store.actions.importTokens("dtcg", "{}");
    expect(seen).toEqual([["dtcg", "{}"]]);
    expect(store.getState().toast).toMatchObject({ tone: "success", text: "Imported 1 tokens", undo: true });
  });
  it("exports tokens.css or says it is up to date", async () => {
    let files = ["tokens.css"];
    const { client } = createFakeClient({
      exportTokens: async () => ({ files, revision: 3, effective: true, path: null, message: files.length ? "Saved to tokens.css" : "tokens.css is up to date." }),
      pageTree: async () => ({ tag: "body" } as ElementNode),
    });
    const store = createStudioStore(client);
    store.setState({ page: "Home" });
    await store.actions.exportTokens();
    expect(store.getState()).toMatchObject({ revision: 3, toast: { tone: "success", text: "Saved to tokens.css" } });
    files = [];
    await store.actions.exportTokens();
    expect(store.getState().toast).toMatchObject({ tone: "info", text: "tokens.css is up to date.", undo: false });
  });
});
