import { describe, expect, it } from "vitest";
import { runFileSystemContract } from "../src/contracts/file-system.contract.ts";
import { runSettingsStoreContract } from "../src/contracts/settings-store.contract.ts";
import { InMemoryFileSystem, MemorySettingsStore, createFakeStudio, normalizeProjectPath } from "../src/contracts/fakes.ts";
import { createFakeStore } from "../src/contracts/fakes-ui.ts";
import { STUDIO_METHODS } from "../src/contracts/ports.ts";
import { MasonError, isMasonError } from "../src/contracts/errors.ts";

runFileSystemContract("in-memory fake", async () => ({ fs: new InMemoryFileSystem(), cleanup: async () => {} }));
runSettingsStoreContract("memory fake", async () => ({ store: new MemorySettingsStore(), cleanup: async () => {} }));

describe("contracts", () => {
  it("lists all 32 studio methods and the fake rejects them", async () => {
    expect(STUDIO_METHODS.length).toBe(32);
    await expect(createFakeStudio().templates()).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
  it("builds MasonError messages from the code and detail", () => {
    const e = new MasonError("FILE_NOT_FOUND", "a.css");
    expect(e.message).toBe("File not found. a.css");
    expect(isMasonError(e)).toBe(true);
    expect(isMasonError(new Error("x"))).toBe(false);
  });
  it("normalizes project paths", () => {
    expect(normalizeProjectPath("./css\\a.css")).toBe("css/a.css");
    expect(() => normalizeProjectPath("../a")).toThrow("Path is outside the project folder.");
  });
  it("records fake store actions", async () => {
    const store = createFakeStore({ page: "Home" });
    await store.actions.selectPage("Menu");
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }]);
    expect(store.getState().page).toBe("Home");
  });
});
