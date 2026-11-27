import { describe, expect, it, vi } from "vitest";

const exposeInMainWorld = vi.fn();
const invoke = vi.fn(async () => "/picked");
vi.mock("electron", () => ({ contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke } }));

describe("desktop preload", () => {
  it("exposes only the folder picker as window.masonDesktop", async () => {
    await import("../../src/desktop/preload.ts");
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, bridge] = exposeInMainWorld.mock.calls[0] as [string, { isDesktop: boolean; pickFolder(): Promise<string | null> }];
    expect(name).toBe("masonDesktop");
    expect(Object.keys(bridge).sort()).toEqual(["isDesktop", "pickFolder"]);
    expect(bridge.isDesktop).toBe(true);
    expect(await bridge.pickFolder()).toBe("/picked");
    expect(invoke).toHaveBeenCalledWith("mason:pick-folder");
  });
});
