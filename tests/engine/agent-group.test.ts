import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { parseAgentReply } from "../../src/engine/studio/agent-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("agent group", () => {
  it("parses replies, defaulting the scope and accepting fenced JSON", () => {
    expect(parseAgentReply('```json\n{"summary":"s","changes":[{"prop":"font-size","value":30}]}\n```', "1.0", "tablet")).toEqual({
      summary: "s", changes: [{ path: "1.0", prop: "font-size", value: "30", scope: "tablet" }],
    });
    expect(() => parseAgentReply("Sure! Here you go", "1", "all")).toThrow("The agent reply was not valid JSON.");
    expect(() => parseAgentReply('{"changes": []}', "1", "all")).toThrow("The agent reply was not valid JSON.");
  });
  it("asks the model with context and taste rules, then files a proposal", async () => {
    const deps = createTestDeps({ "/p": fixtureFiles() });
    deps.llm.replies.push(JSON.stringify({ summary: "Smaller on tablets", changes: [{ prop: "font-size", value: "30px" }] }));
    const studio = createStudio(deps);
    await studio.openProject("/p");
    const p = await studio.askAgent({ page: "Home", path: "1.0.0.1", prompt: "Make it smaller", scope: "tablet" });
    expect([p.source, p.summary, p.changes[0].label, p.changes[0].from, p.changes[0].scope]).toEqual(["qwen2.5-coder:7b", "Smaller on tablets", "Headline size", "32px", "tablet"]);
    const [system, user] = deps.llm.requests[0];
    expect(system.role).toBe("system");
    expect(system.content).toContain("Allowed properties: display, flex-direction");
    expect(system.content).toContain("No stock AI purple");
    const sent = JSON.parse(user.content);
    expect(sent).toMatchObject({ request: "Make it smaller", scope: "tablet", element: { name: "Headline", tag: "h1", selector: ".headline" } });
    expect(sent.currentValues["font-size"]).toBe("32px");
  });
  it("rejects an empty request and passes LLM errors through", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.askAgent({ page: "Home", path: "1", prompt: " ", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(studio.askAgent({ page: "Home", path: "1", prompt: "x", scope: "all" })).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
  });
});
