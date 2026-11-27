import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planStyleEdit } from "../../src/engine/css/plan-style.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanStyleEdit } from "../../src/contracts/engine.ts";
import type { Scope } from "../../src/contracts/model.ts";

const _t: PlanStyleEdit = planStyleEdit;
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const fixture = readFileSync("tests/fixtures/northfield/styles.css", "utf8");

function run(css: string, path: string, prop: string, value: string, scope: Scope, selector = ".x"): string {
  const sheet = parseStylesheet("styles.css", css);
  const edits = planStyleEdit({ sheets: [sheet], el: page.matcher(path)!, elementSelector: selector, prop, value, scope, defaultFile: "styles.css" });
  return applyTextEdits(css, edits);
}

describe("planStyleEdit for all sizes", () => {
  it("replaces the winning value", () => {
    const out = run(fixture, "1.0.0.1", "font-size", "44px", "all");
    expect(out).toContain(".hero h1 {\n  font-family: var(--font-display);\n  font-size: 44px;");
    expect(out).toContain("@media (max-width: 768px) {\n  .hero {\n    grid-template-columns: 1fr;\n    padding: 40px 32px;\n  }\n  .hero h1 {\n    font-size: 32px;");
  });
  it("inserts into the first applying base rule of a multi-line rule with its indent", () => {
    const out = run(fixture, "1.0.0.1", "margin", "0", "all");
    expect(out).toContain("  color: #1e2a22;\n  margin: 0;\n}");
  });
  it("inserts into a single-line rule", () => {
    expect(run(fixture, "1.0.0.2", "margin", "0 0 16px", "all")).toContain(".lede { font-size: 17px; color: #4a544c; margin: 0 0 16px; }");
  });
  it("appends a new rule when no rule matches", () => {
    expect(run("a { color: red; }", "1.0.0.0", "margin", "0", "all", ".eyebrow-x")).toBe("a { color: red; }\n.eyebrow-x {\n  margin: 0;\n}\n");
  });
  it("rejects empty values and values with ; { }", () => {
    expect(() => run(fixture, "1.0.0.1", "color", "  ", "all")).toThrow("Invalid input.");
    expect(() => run(fixture, "1.0.0.1", "color", "red; x: y", "all")).toThrow("Invalid input.");
  });
});

describe("planStyleEdit for tablet and mobile", () => {
  it("replaces an existing override in the matching media rule", () => {
    const out = run(fixture, "1.0.0.1", "font-size", "30px", "tablet");
    expect(out).toContain("  .hero h1 {\n    font-size: 30px;\n  }");
    expect(out).toContain(".hero h1 {\n  font-family: var(--font-display);\n  font-size: 40px;");
  });
  it("inserts into a matching rule inside the media block", () => {
    expect(run(fixture, "1.0.0.1", "line-height", "1.1", "tablet")).toContain("  .hero h1 {\n    font-size: 32px;\n    line-height: 1.1;\n  }");
    expect(run(fixture, "1.0.0.1", "margin", "0", "mobile")).toContain("  .hero h1 { font-size: 28px; margin: 0; }");
  });
  it("adds a rule to the last media block after the base rule", () => {
    const out = run(fixture, "1.0.0.2", "font-size", "15px", "tablet");
    expect(out).toContain("  .hero h1 {\n    font-size: 32px;\n  }\n  .lede {\n    font-size: 15px;\n  }\n}\n\n@media (max-width: 375px)");
  });
  it("appends a new media block when none follows the base rule", () => {
    const css = "@media (max-width: 768px) {\n  .x { color: red; }\n}\n.lede { font-size: 17px; }\n";
    expect(run(css, "1.0.0.2", "font-size", "15px", "tablet")).toBe(css + "\n@media (max-width: 768px) {\n  .lede {\n    font-size: 15px;\n  }\n}\n");
  });
  it("uses the element selector when no base rule sets the property", () => {
    expect(run("p { color: red; }\n", "1.0.0.2", "gap", "4px", "mobile", ".lede")).toBe("p { color: red; }\n\n@media (max-width: 375px) {\n  .lede {\n    gap: 4px;\n  }\n}\n");
  });
});
