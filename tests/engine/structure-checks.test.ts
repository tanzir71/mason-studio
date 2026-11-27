import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkPageStructure, checkRawColors, normalizeHex } from "../../src/engine/checks/structure.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import type { CheckPageStructure, CheckRawColors } from "../../src/contracts/engine.ts";

const _t: [CheckPageStructure, CheckRawColors] = [checkPageStructure, checkRawColors];
void _t;
const fx = (f: string) => readFileSync(`tests/fixtures/northfield/${f}`, "utf8");

describe("structure checks", () => {
  it("passes the fixture home page", () => {
    expect(checkPageStructure(parsePage("index.html", fx("index.html")).body)).toEqual({ findings: [], passed: ["Headings in order", "Images have alt text"] });
  });
  it("finds a missing alt on the menu page", () => {
    const r = checkPageStructure(parsePage("menu.html", fx("menu.html")).body);
    expect(r.findings.map((f) => [f.id.startsWith("a11y:alt:"), f.title, f.severity])).toEqual([[true, "Image has no alt text", "warning"]]);
    expect(r.passed).toEqual(["Headings in order"]);
  });
  it("finds extra H1s and heading jumps", () => {
    const body = parsePage("a.html", "<body><h1>a</h1><h3>b</h3><h1>c</h1></body>").body;
    expect(checkPageStructure(body).findings.map((f) => [f.id, f.title, f.path])).toEqual([
      ["a11y:h1-count", "Page has 2 H1 headings", null],
      ["a11y:heading:1", "Heading jumps from H1 to H3", "1"],
    ]);
  });
});

describe("raw colors", () => {
  it("normalizes hex colors", () => {
    expect([normalizeHex("#ABC"), normalizeHex("#1e2a22ff"), normalizeHex("#Fbf8f2")]).toEqual(["#aabbcc", "#1e2a22", "#fbf8f2"]);
  });
  it("reports raw colors outside :root and suggests matching tokens", () => {
    const tokens = parseDtcg(fx("tokens.json"), "tokens.json").tokens;
    const sheets = [parseStylesheet("tokens.css", fx("tokens.css")), parseStylesheet("styles.css", fx("styles.css"))];
    const found = checkRawColors(sheets, tokens);
    expect(found.map((f) => [f.id, f.title, f.detail])).toEqual([
      ["tokens:styles.css:22:color", "Raw color #1e2a22 in .hero h1", "Use color.ink instead."],
      ["tokens:styles.css:35:color", "Raw color #4a544c in .lede", "Use color.muted instead."],
      ["tokens:styles.css:37:color", "Raw color #f3eee4 in .order-button", "Use color.cream instead."],
      ["tokens:styles.css:49:background-color", "Raw color #fbf8f2 in .card", "Not a token."],
      ["tokens:styles.css:51:color", "Raw color #4a544c in .footer", "Use color.muted instead."],
    ]);
    expect(found.every((f) => f.kind === "tokens" && f.severity === "info" && f.path === null)).toBe(true);
  });
});
