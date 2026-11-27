import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkBans, parseTaste } from "../../src/engine/checks/taste.ts";
import type { CheckBans, ParseTaste } from "../../src/contracts/engine.ts";

const _t: [ParseTaste, CheckBans] = [parseTaste, checkBans];
void _t;
const taste = readFileSync("tests/fixtures/northfield/.mason/taste.md", "utf8");

describe("taste profile", () => {
  it("reads sections and hard bans with notes split at the last ' | '", () => {
    const p = parseTaste(taste);
    expect(Object.keys(p.sections)).toEqual(["design", "copy", "hard bans"]);
    expect(p.sections.design).toBe("- Serif headlines, sans body.\n- One accent: rust.");
    expect(p.bans).toEqual([
      { kind: "literal", pattern: "linear-gradient", note: "No gradients", line: 11 },
      { kind: "regex", pattern: "#(6e56cf|7c3aed)", note: "No stock AI purple", line: 12 },
      { kind: "literal", pattern: "!important", note: "Fix specificity instead", line: 13 },
    ]);
    expect(p.invalid).toEqual(["regex: (["]);
  });
  it("defaults the note to the pattern", () => {
    expect(parseTaste("## Hard bans\n- literal: Lorem ipsum\n").bans).toEqual([{ kind: "literal", pattern: "Lorem ipsum", note: "Lorem ipsum", line: 2 }]);
  });
  it("finds literal and regex bans case-insensitively", () => {
    const p = parseTaste(taste);
    const hits = checkBans(p, "background: LINEAR-GRADIENT(#7C3AED, red)", { file: "a.css", line: 3, path: null });
    expect(hits).toEqual([
      { id: "taste:11", kind: "taste", severity: "blocked", title: "No gradients", detail: 'Matches "literal: linear-gradient".', file: "a.css", line: 3, path: null },
      { id: "taste:12", kind: "taste", severity: "blocked", title: "No stock AI purple", detail: 'Matches "regex: #(6e56cf|7c3aed)".', file: "a.css", line: 3, path: null },
    ]);
    expect(checkBans(p, "color: red;", { file: null, line: null, path: "1" })).toEqual([]);
  });
});
