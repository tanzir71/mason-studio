import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function studio() {
  const s = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await s.openProject("/p");
  return s;
}

describe("inspect group", () => {
  it("reports name, tag, selector and font-size per breakpoint", async () => {
    const r = await (await studio()).inspect("Home", "1.0.0.1");
    expect([r.name, r.tag, r.selector]).toEqual(["Headline", "h1", ".headline"]);
    expect(r.props["font-size"].values).toEqual({ desktop: "40px", tablet: "32px", mobile: "28px" });
    expect(r.props["font-size"].overriddenAt).toEqual(["tablet", "mobile"]);
    expect(r.props["font-size"].winners.tablet).toEqual({ file: "styles.css", line: 58, selector: ".hero h1", media: "(max-width: 768px)" });
    expect(r.props.color.values.desktop).toBe("#1e2a22");
    expect(r.props.padding.values).toEqual({ desktop: null, tablet: null, mobile: null });
  });
  it("lists cascade rows with winning and overridden declarations", async () => {
    const r = await (await studio()).inspect("Home", "1.0.0.1");
    const tablet = r.rules.tablet.map((row) => [row.rule.selector, row.rule.media, row.applies]);
    expect(tablet).toEqual([[".hero h1", "(max-width: 768px)", true], [".hero h1", null, true], [".hero h1", "(max-width: 375px)", false]]);
    const base = r.rules.tablet[1].declarations.find((d) => d.prop === "font-size");
    expect(base).toEqual({ prop: "font-size", value: "40px", status: "overridden" });
    expect(r.rules.desktop[0].declarations.find((d) => d.prop === "font-size")!.status).toBe("winning");
  });
  it("rejects a missing element", async () => {
    await expect((await studio()).inspect("Home", "9.9")).rejects.toMatchObject({ code: "ELEMENT_NOT_FOUND" });
  });
});
