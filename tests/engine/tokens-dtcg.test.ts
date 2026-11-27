import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cssVarName, parseDtcg, serializeDtcg } from "../../src/engine/tokens/dtcg.ts";
import type { CssVarName, ParseDtcg, SerializeDtcg } from "../../src/contracts/engine.ts";

const _t: [ParseDtcg, SerializeDtcg, CssVarName] = [parseDtcg, serializeDtcg, cssVarName];
void _t;
const fixture = readFileSync("tests/fixtures/northfield/tokens.json", "utf8");

describe("parseDtcg", () => {
  it("reads the fixture with inherited types, objects and arrays", () => {
    const set = parseDtcg(fixture, "tokens.json");
    expect(set.file).toBe("tokens.json");
    expect(set.tokens.map((t) => [t.name, t.type, t.value])).toEqual([
      ["color.cream", "color", "#f3eee4"], ["color.ink", "color", "#1e2a22"], ["color.muted", "color", "#4a544c"],
      ["color.rust", "color", "#b4532a"], ["font.display", "fontFamily", "Fraunces, Georgia, serif"],
      ["space.4", "dimension", "16px"], ["space.6", "dimension", "32px"], ["type.display", "dimension", "40px"],
    ]);
    expect(set.tokens[7].byBreakpoint).toEqual({ tablet: "32px", mobile: "28px" });
  });
  it("resolves aliases and converts color components", () => {
    const set = parseDtcg(JSON.stringify({
      a: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0.5], alpha: 0.5 } },
      b: { $type: "color", $value: "{a}" },
      skip: { $type: "shadow", $value: "x" },
    }), null);
    expect(set.tokens).toEqual([
      { name: "a", type: "color", value: "#ff008080", alias: null, byBreakpoint: {} },
      { name: "b", type: "color", value: "#ff008080", alias: "a", byBreakpoint: {} },
    ]);
  });
  it("rejects invalid JSON and unknown aliases", () => {
    expect(() => parseDtcg("{", null)).toThrow("The tokens file could not be read.");
    expect(() => parseDtcg('{ "a": { "$type": "color", "$value": "{nope}" } }', null)).toThrow("The tokens file could not be read. alias nope");
  });
  it("names CSS variables", () => {
    expect(cssVarName("color.ink")).toBe("--color-ink");
    expect(cssVarName("Space Big.2")).toBe("--space-big-2");
  });
});

describe("serializeDtcg", () => {
  it("round-trips through parseDtcg", () => {
    const set = parseDtcg(fixture, "tokens.json");
    expect(parseDtcg(serializeDtcg(set), "tokens.json")).toEqual(set);
  });
  it("writes nested groups with DTCG objects", () => {
    const json = JSON.parse(serializeDtcg({ file: null, tokens: [
      { name: "space.4", type: "dimension", value: "16px", alias: null, byBreakpoint: {} },
      { name: "space.gap", type: "dimension", value: "16px", alias: "space.4", byBreakpoint: {} },
    ] }));
    expect(json).toEqual({ space: { "4": { $type: "dimension", $value: { value: 16, unit: "px" } }, gap: { $type: "dimension", $value: "{space.4}" } } });
  });
});
