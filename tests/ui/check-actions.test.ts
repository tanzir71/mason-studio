import { describe, expect, it } from "vitest";
import { createStudioStore } from "../../src/ui/state/create-store.ts";
import { createFakeClient } from "../../src/contracts/fakes-ui.ts";
import type { CheckFinding, CheckReport } from "../../src/contracts/model.ts";

describe("check actions", () => {
  it("runs checks for the open page", async () => {
    const report: CheckReport = { page: "Home", findings: [], passed: ["Headings in order"] };
    const pages: string[] = [];
    const store = createStudioStore(createFakeClient({ checks: async (p) => { pages.push(p); return report; } }).client);
    await store.actions.runChecks();
    expect(pages).toEqual([]);
    store.setState({ page: "Home" });
    await store.actions.runChecks();
    expect([pages, store.getState().checks]).toEqual([["Home"], report]);
  });
  it("stores contrast findings", () => {
    const store = createStudioStore(createFakeClient().client);
    const f = { id: "a11y:contrast:1" } as CheckFinding;
    store.actions.setContrast([f]);
    expect(store.getState().contrast).toEqual([f]);
  });
});
