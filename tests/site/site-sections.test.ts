import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("site/index.html", "utf8");

describe("files and responsive sections", () => {
  it("explains that the files are the design", () => {
    expect(html).toContain('<section class="band" id="files">');
    expect(html).toContain("<h2>No export step.<br>No drift.</h2>");
    for (const f of ["index.html", "styles.css", "git"]) expect(html).toContain(`<dt><code>${f}</code></dt>`);
    expect(html).toContain('<span class="diff__add">    font-size: 32px;</span>');
  });
  it("shows breakpoints side by side", () => {
    expect(html).toContain('id="responsive"');
    expect(html).toContain("<h2>Breakpoints side by side, not separate mockups.</h2>");
    expect(html.indexOf('id="files"')).toBeLessThan(html.indexOf('id="responsive"'));
    expect(html.indexOf('id="responsive"')).toBeLessThan(html.indexOf("<!-- sections -->"));
  });
});
