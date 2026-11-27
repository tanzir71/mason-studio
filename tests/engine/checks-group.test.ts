import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { sortFindings } from "../../src/engine/studio/checks-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import type { CheckFinding } from "../../src/contracts/model.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup(files = fixtureFiles()) {
  const deps = createTestDeps({ "/p": files });
  const s = createStudio(deps);
  await s.openProject("/p");
  return s;
}

describe("checks group", () => {
  it("sorts blocked, then warnings, then info", () => {
    const f = (id: string, severity: CheckFinding["severity"]) => ({ id, severity } as CheckFinding);
    expect(sortFindings([f("b", "info"), f("a", "warning"), f("c", "blocked"), f("a", "info")]).map((x) => x.id + x.severity)).toEqual(["cblocked", "awarning", "ainfo", "binfo"]);
  });
  it("reports raw colors, the invalid regex and what passed on the home page", async () => {
    const r = await (await setup()).checks("Home");
    expect(r.page).toBe("Home");
    expect(r.findings.filter((f) => f.kind === "tokens").length).toBe(5);
    expect(r.findings.find((f) => f.id === "taste:invalid:0")).toMatchObject({ severity: "info", title: "Invalid regex: ([", file: ".mason/taste.md" });
    expect(r.passed).toEqual(["Headings in order", "Images have alt text", "No hard bans matched"]);
  });
  it("blocks a hard ban once, at its first line", async () => {
    const files = fixtureFiles();
    files["styles.css"] += "\n.x { background: linear-gradient(red, blue); }\n.y { background: linear-gradient(red, blue); }\n";
    const r = await (await setup(files)).checks("Home");
    const bans = r.findings.filter((f) => f.kind === "taste" && f.severity === "blocked");
    expect(bans).toEqual([{ id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "styles.css", line: 67, path: null }]);
    expect(r.findings[0].id).toBe("taste:11");
  });
});
