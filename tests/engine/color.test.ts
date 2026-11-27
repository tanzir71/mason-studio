import { describe, expect, it } from "vitest";
import { contrastRatio, parseCssColor } from "../../src/engine/checks/color.ts";
import type { ContrastRatio, ParseCssColor } from "../../src/contracts/engine.ts";

const _t: [ParseCssColor, ContrastRatio] = [parseCssColor, contrastRatio];
void _t;

describe("colors", () => {
  it("parses hex, rgb and named colors", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor("#1E2A22")).toEqual({ r: 30, g: 42, b: 34, a: 1 });
    expect(parseCssColor("#00000080")).toEqual({ r: 0, g: 0, b: 0, a: 0.502 });
    expect(parseCssColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseCssColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseCssColor("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseCssColor("Transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColor("var(--x)")).toBeNull();
    expect(parseCssColor("#12345")).toBeNull();
  });
  it("computes WCAG contrast ratios", () => {
    const white = parseCssColor("white")!;
    expect(contrastRatio(parseCssColor("black")!, white)).toBe(21);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(parseCssColor("#777777")!, white)).toBe(4.48);
    expect(contrastRatio(parseCssColor("rgba(0, 0, 0, 0.5)")!, white)).toBe(3.98);
  });
});
