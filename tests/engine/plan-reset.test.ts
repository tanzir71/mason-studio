import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planResetOverride, removalRange } from "../../src/engine/css/plan-reset.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanResetOverride } from "../../src/contracts/engine.ts";
import type { Scope } from "../../src/contracts/model.ts";

const _t: PlanResetOverride = planResetOverride;
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const fixture = readFileSync("tests/fixtures/northfield/styles.css", "utf8");
const run = (css: string, path: string, prop: string, scope: Scope) =>
  applyTextEdits(css, planResetOverride({ sheets: [parseStylesheet("styles.css", css)], el: page.matcher(path)!, prop, scope }));

describe("planResetOverride", () => {
  it("does nothing for all sizes", () => {
    expect(planResetOverride({ sheets: [parseStylesheet("styles.css", fixture)], el: page.matcher("1.0.0.1")!, prop: "font-size", scope: "all" })).toEqual([]);
  });
  it("removes a rule whose only declaration is reset", () => {
    expect(run(fixture, "1.0.0.1", "font-size", "tablet")).toContain("    padding: 40px 32px;\n  }\n}\n\n@media (max-width: 375px)");
  });
  it("removes the whole media block when its last rule goes", () => {
    expect(run(fixture, "1.0.0.1", "font-size", "mobile").endsWith("    font-size: 32px;\n  }\n}\n\n")).toBe(true);
  });
  it("removes only the declaration when the rule keeps others", () => {
    const css = "@media (max-width: 768px) {\n  .hero h1 {\n    font-size: 32px;\n    margin: 0;\n  }\n}\n";
    expect(run(css, "1.0.0.1", "font-size", "tablet")).toBe("@media (max-width: 768px) {\n  .hero h1 {\n    margin: 0;\n  }\n}\n");
  });
  it("starts a removal at the newline before indentation", () => {
    expect(removalRange("a\n   b;", { start: 5, end: 7 })).toEqual({ start: 1, end: 7 });
    expect(removalRange("a { b; }", { start: 4, end: 6 })).toEqual({ start: 4, end: 6 });
  });
});
