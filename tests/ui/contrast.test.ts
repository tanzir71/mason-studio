// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { collectContrast, parseRgb, ratioOf } from "../../src/ui/canvas/contrast.ts";
import { contrastRatio, parseCssColor } from "../../src/engine/checks/color.ts";

describe("contrast in boards", () => {
  it("parses computed colors", () => {
    expect(parseRgb("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseRgb("rgba(1, 2, 3, 0.25)")).toEqual({ r: 1, g: 2, b: 3, a: 0.25 });
    expect(parseRgb("rgb(1 2 3 / 50%)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseRgb("currentcolor")).toBeNull();
  });
  it("matches the engine's contrast formula", () => {
    for (const [fg, bg] of [["#777777", "#ffffff"], ["#b4532a", "#f3eee4"], ["#1e2a22", "#fbf8f2"]]) {
      expect(ratioOf(parseRgb(fg)!, parseRgb(bg)!)).toBe(contrastRatio(parseCssColor(fg)!, parseCssColor(bg)!));
    }
  });
  it("flags low-contrast text with its path and keeps large text at 3:1", () => {
    document.body.innerHTML = `
      <main style="background-color: rgb(255, 255, 255)">
        <p style="color: rgb(170, 170, 170)">Faint</p>
        <h1 style="color: rgb(140, 140, 140); font-size: 32px">Big enough</h1>
        <p style="color: rgb(0, 0, 0)">Fine</p>
        <p style="color: rgb(170, 170, 170); display: none">Hidden</p>
      </main>`;
    const found = collectContrast(document);
    expect(found.map((f) => [f.id, f.title, f.detail, f.path])).toEqual([
      ["a11y:contrast:0.0", "Text contrast 2.32:1 is below 4.5:1", "rgb(170, 170, 170) on rgb(255, 255, 255)", "0.0"],
    ]);
  });
});
