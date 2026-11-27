import { describe, expect, it } from "vitest";
import { runTool, structureOf } from "../../src/server/mcp/tools.ts";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function studio() {
  const s = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await s.openProject("/p");
  return s;
}

describe("MCP tools", () => {
  it("lists pages and the visible structure", async () => {
    const s = await studio();
    expect(await runTool(s, "list_pages", {})).toEqual([{ name: "Home", file: "index.html", title: "Northfield Coffee" }, { name: "Menu", file: "menu.html", title: "Menu" }]);
    const tree = structureOf(await s.pageTree("Home"));
    expect(tree.children.map((c) => c.name)).toEqual(["Header", "Main", "Footer"]);
    expect(Object.keys(tree.children[0])).toEqual(["path", "tag", "name", "kind", "children"]);
  });
  it("describes an element with only the properties that have values", async () => {
    const data = await runTool(await studio(), "get_element", { page: "Home", path: "1.0.0.1" }) as { values: Record<string, unknown>; selector: string };
    expect(data.selector).toBe(".headline");
    expect(data.values["font-size"]).toEqual({ desktop: "40px", tablet: "32px", mobile: "28px" });
    expect(data.values.padding).toBeUndefined();
  });
  it("files proposals with the agent name and reports their status", async () => {
    const s = await studio();
    const data = await runTool(s, "propose_style_changes", { page: "Home", summary: "Purple hero", agent_name: "Claude Code",
      changes: [{ path: "1.0", prop: "background-color", value: "#6e56cf", scope: "all" }] }) as { proposal_id: string; blocked: unknown[]; message: string };
    expect(data).toEqual({ proposal_id: "id-1", blocked: [{ label: "Hero fill", reason: "No stock AI purple" }], message: "Proposal id-1 is waiting for review in Mason. Nothing was written." });
    expect((await s.proposals())[0].source).toBe("Claude Code");
    expect(await runTool(s, "get_proposal", { id: "id-1" })).toEqual({ id: "id-1", status: "pending", changes: [{ label: "Hero fill", value: "#6e56cf", blocked: true }] });
  });
  it("lists tokens and check findings, and rejects missing arguments", async () => {
    const s = await studio();
    expect((await runTool(s, "list_tokens", {}) as unknown[])[0]).toEqual({ name: "color.cream", type: "color", value: "#f3eee4" });
    expect((await runTool(s, "check_page", { page: "Home" }) as { severity: string }[]).length).toBe(6);
    await expect(runTool(s, "get_page_structure", {})).rejects.toThrow('Invalid input. "page" must be a non-empty string.');
  });
});
