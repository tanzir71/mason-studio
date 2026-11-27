import { describe, expect, it, vi } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { clampZoom } from "../../src/ui/state/view-actions.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { InspectResult } from "../../src/contracts/model.ts";

describe("view actions", () => {
  it("select sets the selection and loads inspect", async () => {
    const store = createStudioStore(createFakeClient({ inspect: async (page, path) => ({ page, path } as InspectResult) }).client);
    store.setState({ page: "Home" });
    store.actions.select("1.0");
    expect(store.getState().selection).toBe("1.0");
    await vi.waitFor(() => expect(store.getState().inspect).toEqual({ page: "Home", path: "1.0" }));
    store.actions.select(null);
    expect([store.getState().selection, store.getState().inspect]).toEqual([null, null]);
  });
  it("select keeps working when inspect fails", async () => {
    const store = createStudioStore(createFakeClient().client);
    store.setState({ page: "Home" });
    store.actions.select("0");
    await new Promise((r) => setTimeout(r, 0));
    expect([store.getState().selection, store.getState().inspect, store.getState().toast]).toEqual(["0", null, null]);
  });
  it("keeps scope and active board in step", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.setScope("mobile");
    expect([store.getState().scope, store.getState().activeBoard]).toEqual(["mobile", "mobile"]);
    store.actions.setActiveBoard("desktop");
    expect([store.getState().scope, store.getState().activeBoard]).toEqual(["all", "desktop"]);
    store.actions.setActiveBoard("tablet");
    expect(store.getState().scope).toBe("tablet");
  });
  it("clamps and rounds zoom, and pans", () => {
    expect([clampZoom(0.01), clampZoom(5), clampZoom(0.456)]).toEqual([0.1, 2, 0.46]);
    const store = createStudioStore(createFakeClient().client);
    store.actions.setZoom(3);
    store.actions.panBy(10, -5);
    store.actions.panBy(1, 1);
    expect([store.getState().zoom, store.getState().pan]).toEqual([2, { x: 11, y: -4 }]);
  });
  it("sets tool and tabs", () => {
    const store = createStudioStore(createFakeClient().client);
    store.actions.setTool("hand");
    store.actions.setLeftTab("assets");
    store.actions.setRightTab("checks");
    store.actions.hover("0.1");
    expect(store.getState()).toMatchObject({ tool: "hand", leftTab: "assets", rightTab: "checks", hover: "0.1" });
  });
});
