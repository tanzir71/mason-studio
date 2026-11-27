import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { checkPageStructure } from "../../src/engine/checks/structure.ts";
import { checkBans, parseTaste } from "../../src/engine/checks/taste.ts";

const html = readFileSync("site/index.html", "utf8");
const css = readFileSync("site/styles.css", "utf8");

describe("finished landing page", () => {
  it("passes Mason's own structure checks", () => {
    expect(checkPageStructure(parsePage("index.html", html).body)).toEqual({ findings: [], passed: ["Headings in order", "Images have alt text"] });
  });
  it("has every in-page link target", () => {
    const targets = [...html.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
    for (const id of new Set(targets)) expect(html).toContain(`id="${id}"`);
    for (const id of ["files", "responsive", "agents", "penpot", "download"]) expect(html).toContain(`id="${id}"`);
  });
  it("ends with the download card and footer", () => {
    expect(html).toContain("<h2>Get Mason</h2>");
    expect(html).toContain('<h2 class="privacy__title">No account. No server.<br>No telemetry.</h2>');
    expect(html.trimEnd().endsWith("</footer>\n</body>\n</html>")).toBe(true);
  });
  it("follows the design rules: no italics, gradients or !important", () => {
    const sheet = parseStylesheet("styles.css", css);
    expect(sheet.rules.length).toBeGreaterThan(100);
    const taste = parseTaste("## Hard bans\n- literal: italic | No italics\n- literal: linear-gradient | No gradients\n- literal: !important | No !important\n");
    expect(checkBans(taste, css, { file: "styles.css", line: null, path: null })).toEqual([]);
    expect(html).not.toMatch(/<(i|em)>/);
  });
});
