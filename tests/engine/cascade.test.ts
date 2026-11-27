import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchingRules, resolveCascade } from "../../src/engine/css/cascade.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { MatchingRules, ResolveCascade } from "../../src/contracts/engine.ts";

const _t: [MatchingRules, ResolveCascade] = [matchingRules, resolveCascade];
void _t;
const page = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));
const styles = parseStylesheet("styles.css", readFileSync("tests/fixtures/northfield/styles.css", "utf8"));
const h1 = page.matcher("1.0.0.1")!;

describe("matchingRules", () => {
  it("orders applying rules by specificity, then source order", () => {
    const rows = matchingRules([styles], h1, 768).map((m) => [m.rule.selector, m.rule.media, m.applies]);
    expect(rows).toEqual([[".hero h1", "(max-width: 768px)", true], [".hero h1", null, true], [".hero h1", "(max-width: 375px)", false]]);
  });
  it("picks the most specific matching selector of a list", () => {
    const sheet = parseStylesheet("a.css", "h1, .hero .headline, p { color: red; }\n");
    const [m] = matchingRules([sheet], h1, 1280);
    expect([m.selector, m.specificity]).toEqual([".hero .headline", [0, 2, 0]]);
  });
  it("ranks later sheets above earlier ones at equal specificity", () => {
    const a = parseStylesheet("a.css", ".headline { color: red; }\n");
    const b = parseStylesheet("b.css", ".headline { color: blue; }\n");
    expect(matchingRules([a, b], h1, 1280).map((m) => m.rule.file)).toEqual(["b.css", "a.css"]);
  });
});

describe("resolveCascade", () => {
  it("finds the winning font-size at each breakpoint", () => {
    const win = (w: number) => resolveCascade([styles], h1, "font-size", w).find((e) => e.winning)?.declaration.value;
    expect([win(1280), win(768), win(375)]).toEqual(["40px", "32px", "28px"]);
  });
  it("lets !important beat specificity and marks non-applying entries", () => {
    const sheet = parseStylesheet("a.css", "h1 { color: red !important; }\n.hero h1 { color: blue; }\n@media (max-width: 100px) { h1 { color: green; } }\n");
    const entries = resolveCascade([sheet], h1, "color", 1280);
    expect(entries.map((e) => [e.declaration.value, e.winning, e.applies])).toEqual([["red", true, true], ["blue", false, true], ["green", false, false]]);
  });
  it("prefers the later declaration inside one rule and has no winner when nothing applies", () => {
    const sheet = parseStylesheet("a.css", ".headline { color: red; color: blue; }\n@media print { .headline { margin: 0; } }\n");
    expect(resolveCascade([sheet], h1, "color", 1280)[0].declaration.value).toBe("blue");
    expect(resolveCascade([sheet], h1, "margin", 1280).map((e) => e.winning)).toEqual([false]);
    expect(resolveCascade([sheet], h1, "padding", 1280)).toEqual([]);
  });
});
