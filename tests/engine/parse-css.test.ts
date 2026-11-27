import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeMedia, parseStylesheet } from "../../src/engine/css/parse.ts";
import type { NormalizeMedia, ParseStylesheet } from "../../src/contracts/engine.ts";

const _types: [ParseStylesheet, NormalizeMedia] = [parseStylesheet, normalizeMedia];
void _types;
const HERO = ".hero h1 {\n  font-size: 40px;\n  color: red !important;\n}\n";

describe("parseStylesheet", () => {
  it("collects top-level and @media rules in order and ignores other at-rules", () => {
    const css = ".a { color: red; }\n@media (max-width:768px) {\n  .a { color: blue; }\n}\n@supports (display: grid) { .b { color: green; } }\n";
    const sheet = parseStylesheet("x.css", css);
    expect(sheet.rules.map((r) => [r.selector, r.media, r.index])).toEqual([[".a", null, 0], [".a", "(max-width: 768px)", 1]]);
    expect(sheet.mediaBlocks.map((b) => b.media)).toEqual(["(max-width: 768px)"]);
    expect(css[sheet.mediaBlocks[0].bodyEnd]).toBe("}");
  });
  it("records declaration and value ranges", () => {
    const sheet = parseStylesheet("x.css", HERO);
    const [size, color] = sheet.rules[0].declarations;
    expect(size).toMatchObject({ prop: "font-size", value: "40px", important: false, range: { start: 13, end: 29 }, valueRange: { start: 24, end: 28 } });
    expect(HERO.slice(size.range.start, size.range.end)).toBe("font-size: 40px;");
    expect(color).toMatchObject({ prop: "color", value: "red", important: true });
    expect(HERO.slice(color.valueRange.start, color.valueRange.end)).toBe("red");
  });
  it("records the rule range, body range and line", () => {
    const rule = parseStylesheet("x.css", "\n" + HERO).rules[0];
    expect(rule.line).toBe(2);
    expect(rule.range).toEqual({ start: 1, end: 57 });
    expect(rule.bodyRange).toEqual({ start: 11, end: 56 });
    expect(rule.file).toBe("x.css");
  });
  it("throws CSS_PARSE_ERROR with file and line", () => {
    expect(() => parseStylesheet("x.css", "a { color: red;\n")).toThrow("The stylesheet could not be parsed. x.css:1");
  });
  it("parses the fixture stylesheet", () => {
    const text = readFileSync("tests/fixtures/northfield/styles.css", "utf8");
    const sheet = parseStylesheet("styles.css", text);
    expect(sheet.rules.length).toBe(14);
    expect(sheet.mediaBlocks.map((b) => b.media)).toEqual(["(max-width: 768px)", "(max-width: 375px)"]);
    const tablet = sheet.rules[12];
    expect([tablet.selector, tablet.media]).toEqual([".hero h1", "(max-width: 768px)"]);
    const d = tablet.declarations[0];
    expect(text.slice(d.valueRange.start, d.valueRange.end)).toBe("32px");
  });
});

describe("normalizeMedia", () => {
  it("lowercases and normalizes spaces", () => {
    expect(normalizeMedia("( MAX-WIDTH:768px )")).toBe("(max-width: 768px)");
    expect(normalizeMedia("screen   and (min-width:1024px)")).toBe("screen and (min-width: 1024px)");
  });
});
