import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import type { ProposalInput } from "../../src/contracts/model.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  deps.events.emitted.length = 0;
  return { s, deps, fs: deps.openFs("/p") };
}
const input: ProposalInput = { source: "Claude Code", page: "Home", summary: "Tighter tablet headline", changes: [
  { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" },
  { path: "1.0.0.0", prop: "letter-spacing", value: "0.18em", scope: "tablet" },
  { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all" },
] };

describe("proposal group", () => {
  it("labels changes, records current values, blocks taste bans and emits the proposal", async () => {
    const { s, deps } = await setup();
    const p = await s.propose(input);
    expect([p.id, p.status, p.createdAt]).toEqual(["id-1", "pending", 1_002_000]);
    expect(p.changes.map((c) => [c.label, c.from, c.blocked?.title ?? null])).toEqual([
      ["Headline size", "32px", null], ["Eyebrow letter spacing", "0.12em", null], ["Hero fill", null, "No stock AI purple"],
    ]);
    expect(deps.events.emitted).toEqual([{ type: "proposal", proposal: p }]);
    expect((await s.proposals()).map((x) => x.id)).toEqual(["id-1"]);
  });
  it("writes nothing until accepted, then applies the allowed changes as one step", async () => {
    const { s, fs } = await setup();
    const before = await fs.readText("styles.css");
    const p = await s.propose(input);
    expect(await fs.readText("styles.css")).toBe(before);
    const r = await s.acceptProposal(p.id, false);
    expect(r).toMatchObject({ files: ["styles.css"], message: "Applied 2 changes from Claude Code" });
    const css = await fs.readText("styles.css");
    expect(css).toContain("font-size: 30px;");
    expect(css).toContain("letter-spacing: 0.18em;");
    expect(css).not.toContain("#7c3aed");
    expect((await s.proposals())[0].status).toBe("accepted");
    await s.undo();
    expect(await fs.readText("styles.css")).toBe(before);
  });
  it("rejects proposals and refuses closed ones", async () => {
    const { s } = await setup();
    const p = await s.propose(input);
    expect((await s.rejectProposal(p.id)).status).toBe("rejected");
    await expect(s.acceptProposal(p.id, false)).rejects.toMatchObject({ code: "PROPOSAL_CLOSED" });
    await expect(s.rejectProposal("nope")).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" });
  });
  it("validates every change", async () => {
    const { s } = await setup();
    const bad = (change: object) => s.propose({ ...input, changes: [change as never] });
    await expect(bad({ path: "1.0.0.1", prop: "transform", value: "none", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "1.0.0.1", prop: "color", value: "red; x", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "1.0.0.1", prop: "color", value: "red", scope: "print" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "9.9", prop: "color", value: "red", scope: "all" })).rejects.toMatchObject({ code: "ELEMENT_NOT_FOUND" });
    await expect(s.propose({ ...input, changes: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
