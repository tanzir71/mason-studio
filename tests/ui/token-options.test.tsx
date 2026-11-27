// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { tokenForValue, tokenOptions, tokenVar } from "../../src/ui/panels/token-options.ts";
import { Field } from "../../src/ui/components/Field.tsx";
import { parseDtcg } from "../../src/engine/tokens/dtcg.ts";
import { cssVarName } from "../../src/engine/tokens/dtcg.ts";

const tokens = parseDtcg(readFileSync("tests/fixtures/northfield/tokens.json", "utf8"), "tokens.json");

describe("token options", () => {
  it("names variables like the engine", () => {
    for (const t of tokens.tokens) expect(tokenVar(t.name)).toBe(cssVarName(t.name));
  });
  it("offers tokens of the property's type", () => {
    expect(tokenOptions(tokens, "color")).toEqual(["var(--color-cream)", "var(--color-ink)", "var(--color-muted)", "var(--color-rust)"]);
    expect(tokenOptions(tokens, "font-size")).toEqual(["var(--space-4)", "var(--space-6)", "var(--type-display)"]);
    expect(tokenOptions(tokens, "display")).toEqual([]);
    expect(tokenOptions(null, "color")).toEqual([]);
  });
  it("finds the token behind a var() value", () => {
    expect(tokenForValue(tokens, "var(--type-display)")!.value).toBe("40px");
    expect(tokenForValue(tokens, "40px")).toBeNull();
  });
  it("renders field suggestions as a datalist", () => {
    render(<Field label="Fill" value="" options={["var(--color-ink)", "var(--color-rust)"]} onCommit={() => {}} />);
    const input = screen.getByLabelText("Fill");
    const list = document.getElementById(input.getAttribute("list")!)!;
    expect([...list.querySelectorAll("option")].map((o) => o.value)).toEqual(["var(--color-ink)", "var(--color-rust)"]);
  });
});
