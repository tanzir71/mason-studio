import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";

const html = readFileSync("site/index.html", "utf8");

describe("landing page shell", () => {
  it("is a plain page Mason can open, linking styles.css", () => {
    const page = parsePage("index.html", html);
    expect(page.title).toBe("Mason: design on real web pages");
    expect(page.stylesheets).toEqual(["styles.css"]);
    expect(() => parseStylesheet("styles.css", readFileSync("site/styles.css", "utf8"))).not.toThrow();
  });
  it("has the navigation, hero and download links", () => {
    expect(html).toContain('<h1>Design on real web pages.</h1>');
    expect(html).toContain("Open source · local-first · no account");
    expect(html).toContain('<a class="button button--dark" href="#download">Download for macOS</a>');
    expect(html).toContain('src="assets/app-canvas.png"');
    expect(html).toContain("<!-- sections -->");
  });
  it("gives the screenshot a description", () => {
    const img = /<img class="shot"[^>]*alt="([^"]+)"/.exec(html);
    expect(img?.[1].length).toBeGreaterThan(40);
  });
});
