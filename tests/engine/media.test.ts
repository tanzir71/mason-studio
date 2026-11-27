import { describe, expect, it } from "vitest";
import { compareSpecificity, mediaApplies, specificityOf, splitSelectorList } from "../../src/engine/css/media.ts";
import type { MediaApplies, SpecificityOf, SplitSelectorList } from "../../src/contracts/engine.ts";

const _t: [MediaApplies, SpecificityOf, SplitSelectorList] = [mediaApplies, specificityOf, splitSelectorList];
void _t;

describe("mediaApplies", () => {
  it("applies without media and for screen/all", () => {
    expect(mediaApplies(null, 375)).toBe(true);
    expect(mediaApplies("screen", 1280)).toBe(true);
    expect(mediaApplies("only screen and (max-width: 768px)", 768)).toBe(true);
    expect(mediaApplies("print", 1280)).toBe(false);
  });
  it("compares max-width and min-width, counting em as 16px", () => {
    expect(mediaApplies("(max-width: 768px)", 768)).toBe(true);
    expect(mediaApplies("(max-width: 768px)", 1280)).toBe(false);
    expect(mediaApplies("(min-width: 48em)", 768)).toBe(true);
    expect(mediaApplies("(min-width: 48em)", 375)).toBe(false);
  });
  it("treats comma lists as or and unknown terms as false", () => {
    expect(mediaApplies("print, (max-width: 400px)", 375)).toBe(true);
    expect(mediaApplies("(prefers-color-scheme: dark)", 1280)).toBe(false);
    expect(mediaApplies("not screen", 1280)).toBe(false);
  });
});

describe("selectors", () => {
  it("computes specificity of one selector", () => {
    expect(specificityOf(".hero h1")).toEqual([0, 1, 1]);
    expect(specificityOf("#menu .card:hover")).toEqual([1, 2, 0]);
    expect(specificityOf("((")).toEqual([0, 0, 0]);
    expect(compareSpecificity([0, 2, 0], [0, 1, 9])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
  });
  it("splits selector lists on top-level commas only", () => {
    expect(splitSelectorList(" h1, .a:is(.b, .c) , [data-x='a,b'],, p ")).toEqual(["h1", ".a:is(.b, .c)", "[data-x='a,b']", "p"]);
  });
});
