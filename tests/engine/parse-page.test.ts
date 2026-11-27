import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { ElementNode } from "../../src/contracts/model.ts";
import type { ParsePage } from "../../src/contracts/engine.ts";

const _t: ParsePage = parsePage;
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const at = (body: ElementNode, path: string) => path.split(".").reduce((n, i) => n.children[Number(i)], body);

describe("parsePage", () => {
  it("reads the title and local stylesheets", () => {
    const page = parsePage("index.html", html);
    expect(page.title).toBe("Northfield Coffee");
    expect(page.stylesheets).toEqual(["tokens.css", "styles.css"]);
  });
  it("builds the element tree with paths, names and kinds", () => {
    const { body } = parsePage("index.html", html);
    expect(body).toMatchObject({ path: "", tag: "body", name: "Page", kind: "frame" });
    expect(body.children.map((c) => c.tag)).toEqual(["header", "main", "footer"]);
    expect(at(body, "1.0.0.1")).toMatchObject({ path: "1.0.0.1", tag: "h1", name: "Headline", kind: "text", classes: ["headline"], text: "Small-batch coffee, roasted down the street." });
    expect(at(body, "1.1")).toMatchObject({ name: "This week", kind: "stack", attrs: { class: "this-week", id: "menu" } });
    expect(at(body, "0.1.0")).toMatchObject({ tag: "a", name: "Link", kind: "link", text: "Menu", attrs: { href: "menu.html" } });
  });
  it("records element ranges and inner ranges", () => {
    const h1 = at(parsePage("index.html", html).body, "1.0.0.1");
    expect(html.slice(h1.range.start, h1.range.end)).toBe('<h1 class="headline">Small-batch coffee, roasted down the street.</h1>');
    expect(html.slice(h1.innerRange!.start, h1.innerRange!.end)).toBe("Small-batch coffee, roasted down the street.");
    const img = at(parsePage("index.html", html).body, "1.0.1");
    expect(img).toMatchObject({ kind: "image", innerRange: null, attrs: { alt: "The roaster at work", src: "images/roastery.svg", class: "hero-photo" } });
  });
  it("matches selectors against elements by path", () => {
    const page = parsePage("index.html", html);
    expect(page.matcher("1.0.0.1")!.matches(".hero h1")).toBe(true);
    expect(page.matcher("1.0.0.1")!.matches(".lede")).toBe(false);
    expect(page.matcher("1.0.0.1")!.matches("h1:hover")).toBe(false);
    expect(page.matcher("1.0.0.1")!.matches("((")).toBe(false);
    expect(page.matcher("9")).toBeNull();
  });
  it("keeps only relative stylesheets and falls back to the file name for the title", () => {
    const page = parsePage("about.html", '<html><head><link rel="stylesheet" href="./css/a.css?v=2"><link rel="stylesheet" href="https://x.y/b.css"><link rel="stylesheet" href="/c.css"><link rel="icon" href="d.css"></head><body><p>x</p></body></html>');
    expect(page.stylesheets).toEqual(["css/a.css"]);
    expect(page.title).toBe("about");
  });
  it("cuts long text to 80 characters plus an ellipsis", () => {
    const long = "word ".repeat(30).trim();
    const p = parsePage("a.html", `<body><p>${long}</p></body>`).body.children[0];
    expect(p.text).toBe(long.slice(0, 80) + "…");
  });
});
