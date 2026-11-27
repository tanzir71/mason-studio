import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("site/index.html", "utf8");

describe("agents and Penpot sections", () => {
  it("shows the MCP connection, a review card and the taste file", () => {
    expect(html).toContain('id="agents"');
    expect(html).toContain("<h2>Bring your agent. Keep the final say.</h2>");
    expect(html).toContain('"url": "http://127.0.0.1:39765/mcp"');
    expect(html).toContain("Every change waits for your review");
    expect(html).toContain("Blocked: no gradients");
  });
  it("compares fairly with Penpot in an accessible table", () => {
    expect(html).toContain("<h2>Using Penpot? Keep it.</h2>");
    const rows = html.match(/<tr><th scope="row">/g) ?? [];
    expect(rows.length).toBe(8);
    expect(html).toContain("Compared with Penpot 2.19, November 2026.");
    expect(html.indexOf('id="agents"')).toBeLessThan(html.indexOf('id="penpot"'));
  });
});
