import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { escapeText, indentOf, planEditText, planRemoveElement } from "../../src/engine/html/edit.ts";
import { applyTextEdits } from "../../src/engine/css/edits.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { findNode } from "../../src/engine/html/select.ts";
import type { PlanEditText, PlanRemoveElement } from "../../src/contracts/engine.ts";

const _t: [PlanEditText, PlanRemoveElement] = [planEditText, planRemoveElement];
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const page = parsePage("index.html", html);

describe("text and remove planners", () => {
  it("measures the indent of an element's line", () => {
    expect(indentOf(html, findNode(page.body, "1.0.0.1")!)).toBe("        ");
    expect(indentOf(html, findNode(page.body, "1.1.1.0.1")!)).toBe("");
  });
  it("replaces the inner text of a text element, escaped", () => {
    expect(escapeText("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
    const out = applyTextEdits(html, planEditText(page, "1.0.0.1", "Beans & more"));
    expect(out).toContain('<h1 class="headline">Beans &amp; more</h1>');
  });
  it("refuses text edits on containers and missing paths", () => {
    expect(() => planEditText(page, "1.0", "x")).toThrow("Only text elements can be edited as text.");
    expect(() => planEditText(page, "1.7", "x")).toThrow("Element not found.");
  });
  it("removes an element together with its line indent", () => {
    const out = applyTextEdits(html, planRemoveElement(page, html, "1.0.0.0"));
    expect(out).toContain('<div class="hero-copy">\n        <h1 class="headline">');
    expect(out).not.toContain("eyebrow");
  });
  it("refuses to remove the body", () => {
    expect(() => planRemoveElement(page, html, "")).toThrow("Invalid input.");
  });
});
