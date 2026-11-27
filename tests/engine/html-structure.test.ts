import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planInsertElement, planMoveElement, planWrapInStack } from "../../src/engine/html/structure.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { PlanInsertElement, PlanMoveElement, PlanWrapInStack } from "../../src/contracts/engine.ts";

const _t: [PlanInsertElement, PlanMoveElement, PlanWrapInStack] = [planInsertElement, planMoveElement, planWrapInStack];
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const page = parsePage("index.html", html);
const css = { file: "styles.css", text: "a {}\n" };
const htmlOf = (edits: { file: string; start: number; end: number; text: string }[]) => applyTextEdits(html, edits.filter((e) => e.file === "index.html"));

describe("planInsertElement", () => {
  it("inserts before an existing child with its indent and appends the rule", () => {
    const plan = planInsertElement(page, html, css, "1.0.0", 1, "rect");
    expect([plan.className, plan.path]).toEqual(["rect-1", "1.0.0.1"]);
    expect(htmlOf(plan.edits)).toContain('<p class="eyebrow">Roasted on Tuesdays</p>\n        <div class="rect-1"></div>\n        <h1 class="headline">');
    expect(plan.edits[1]).toEqual({ file: "styles.css", start: 5, end: 5, text: ".rect-1 {\n  width: 160px;\n  height: 120px;\n  background-color: #d9d9d9;\n}\n" });
  });
  it("appends after the last child and clamps the index", () => {
    const plan = planInsertElement(page, html, css, "1.0.0", 99, "text");
    expect(plan.path).toBe("1.0.0.4");
    expect(htmlOf(plan.edits)).toContain("Order this week's beans</a>\n        <p class=\"text-1\">Text</p>\n      </div>");
  });
  it("fills an empty element", () => {
    const empty = "<html><body>\n  <main>\n  </main>\n</body></html>";
    const p = parsePage("a.html", empty);
    const plan = planInsertElement(p, empty, css, "0", 0, "frame");
    expect(applyTextEdits(empty, plan.edits.filter((e) => e.file === "a.html"))).toBe('<html><body>\n  <main>\n    <div class="frame-1"></div>\n  </main>\n</body></html>');
  });
  it("needs a stylesheet and a parent with content", () => {
    expect(() => planInsertElement(page, html, null, "1", 0, "rect")).toThrow("This page has no local stylesheet.");
    expect(() => planInsertElement(page, html, css, "1.0.1", 0, "rect")).toThrow("Invalid input.");
  });
});

describe("planMoveElement and planWrapInStack", () => {
  it("moves an element down and up among its siblings", () => {
    const down = planMoveElement(page, html, "1.0.0.0", 2);
    expect(down.path).toBe("1.0.0.2");
    expect(applyTextEdits(html, down.edits)).toContain('<h1 class="headline">Small-batch coffee, roasted down the street.</h1>\n        <p class="lede">We roast twice a week in a 12-kilo drum and deliver by bike across the city.</p>\n        <p class="eyebrow">');
    const up = planMoveElement(page, html, "1.0.0.3", 0);
    expect(up.path).toBe("1.0.0.0");
    expect(applyTextEdits(html, up.edits)).toContain('<div class="hero-copy">\n        <a class="order-button" href="#order">Order this week\'s beans</a>\n        <p class="eyebrow">');
  });
  it("returns no edits when the index does not change", () => {
    expect(planMoveElement(page, html, "1.0.0.1", 1)).toEqual({ edits: [], path: "1.0.0.1" });
  });
  it("wraps an element in a new stack", () => {
    const plan = planWrapInStack(page, html, css, "1.0.0.3");
    expect(plan.className).toBe("stack-1");
    expect(htmlOf(plan.edits)).toContain('<div class="stack-1"><a class="order-button" href="#order">Order this week\'s beans</a></div>');
    expect(plan.edits[2].text).toBe(".stack-1 {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n");
  });
});
