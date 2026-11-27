import { describe, expect, it } from "vitest";
import { fromTokensStudio } from "../../src/engine/tokens/tokens-studio.ts";
import type { FromTokensStudio } from "../../src/contracts/engine.ts";

const _t: FromTokensStudio = fromTokensStudio;
void _t;
const studio = JSON.stringify({
  brand: { color: { primary: { value: "#B4532A", type: "color" } }, radius: { md: { value: "8", type: "borderRadius" } } },
  core: { color: { primary: { value: "#000000", type: "color" }, link: { value: "{color.primary}", type: "color" } }, space: { "2": { value: 8, type: "spacing" } } },
  $metadata: { tokenSetOrder: ["brand", "core"] },
  $themes: [],
});

describe("fromTokensStudio", () => {
  it("reads sets in tokenSetOrder, first set winning", () => {
    expect(fromTokensStudio(studio).tokens.map((t) => [t.name, t.type, t.value, t.alias])).toEqual([
      ["color.link", "color", "#b4532a", "color.primary"],
      ["color.primary", "color", "#b4532a", null],
      ["radius.md", "dimension", "8px", null],
      ["space.2", "dimension", "8px", null],
    ]);
  });
  it("maps font families and skips unknown types", () => {
    const set = fromTokensStudio(JSON.stringify({ g: { body: { value: ["Inter", "sans-serif"], type: "fontFamilies" }, shadow: { value: "x", type: "boxShadow" } } }));
    expect(set).toEqual({ file: null, tokens: [{ name: "body", type: "fontFamily", value: "Inter, sans-serif", alias: null, byBreakpoint: {} }] });
  });
  it("rejects invalid JSON", () => {
    expect(() => fromTokensStudio("nope")).toThrow("The tokens file could not be read.");
  });
});
