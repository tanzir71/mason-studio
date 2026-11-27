import { describe, expect, it } from "vitest";
import { friendlyName, humanize, layerKind } from "../../src/engine/html/names.ts";
import type { FriendlyName, LayerKindOf } from "../../src/contracts/engine.ts";

const _t: [FriendlyName, LayerKindOf] = [friendlyName, layerKind];
void _t;
const n = (tag: string, attrs: Record<string, string> = {}, classes: string[] = []) => ({ tag, attrs, classes });

describe("names", () => {
  it("humanizes kebab, snake and camel case", () => {
    expect(humanize("hero-copy")).toBe("Hero copy");
    expect(humanize("order_button")).toBe("Order button");
    expect(humanize("orderButton")).toBe("Order button");
    expect(humanize("  site--header ")).toBe("Site header");
  });
  it("prefers data-mason-name, then body, then class, then id, then tag", () => {
    expect(friendlyName(n("div", { "data-mason-name": "Promo strip", id: "x" }, ["y"]))).toBe("Promo strip");
    expect(friendlyName(n("body", {}, ["page"]))).toBe("Page");
    expect(friendlyName(n("section", { id: "menu" }, ["this-week"]))).toBe("This week");
    expect(friendlyName(n("footer", { id: "visit" }))).toBe("Visit");
    expect(friendlyName(n("h2"))).toBe("Heading");
    expect(friendlyName(n("custom-el"))).toBe("Custom el");
  });
  it("classifies media, links and the body", () => {
    expect(layerKind({ tag: "img", childTags: [] })).toBe("image");
    expect(layerKind({ tag: "svg", childTags: ["path"] })).toBe("image");
    expect(layerKind({ tag: "a", childTags: ["span"] })).toBe("link");
    expect(layerKind({ tag: "button", childTags: [] })).toBe("link");
    expect(layerKind({ tag: "body", childTags: ["main"] })).toBe("frame");
  });
  it("classifies text elements only when every child is inline", () => {
    expect(layerKind({ tag: "h1", childTags: [] })).toBe("text");
    expect(layerKind({ tag: "p", childTags: ["em", "br", "a"] })).toBe("text");
    expect(layerKind({ tag: "li", childTags: ["h3", "p"] })).toBe("stack");
  });
  it("classifies containers as stacks and anything else as frames", () => {
    expect(layerKind({ tag: "section", childTags: ["div"] })).toBe("stack");
    expect(layerKind({ tag: "ul", childTags: ["li"] })).toBe("stack");
    expect(layerKind({ tag: "table", childTags: ["tr"] })).toBe("frame");
  });
});
