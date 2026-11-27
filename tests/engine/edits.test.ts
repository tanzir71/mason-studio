import { describe, expect, it } from "vitest";
import { applyTextEdits, planAppendRule } from "../../src/engine/css/edits.ts";
import type { ApplyTextEdits, PlanAppendRule } from "../../src/contracts/engine.ts";

const _t: [ApplyTextEdits, PlanAppendRule] = [applyTextEdits, planAppendRule];
void _t;
const e = (start: number, end: number, text: string) => ({ file: "a.css", start, end, text });

describe("applyTextEdits", () => {
  it("applies edits in any order", () => {
    expect(applyTextEdits("abcdef", [e(4, 6, "XY"), e(0, 1, ""), e(2, 2, "-")])).toBe("b-cdXY");
  });
  it("rejects overlapping edits and edits sharing a start", () => {
    expect(() => applyTextEdits("abcdef", [e(0, 3, "x"), e(2, 4, "y")])).toThrow("Two edits overlap.");
    expect(() => applyTextEdits("abcdef", [e(1, 1, "x"), e(1, 1, "y")])).toThrow("Two edits overlap.");
    expect(applyTextEdits("abcdef", [e(0, 2, "x"), e(2, 3, "y")])).toBe("xydef");
  });
  it("rejects out-of-range offsets", () => {
    expect(() => applyTextEdits("abc", [e(2, 9, "")])).toThrow("Invalid input.");
  });
});

describe("planAppendRule", () => {
  it("appends a rule, adding a newline when the file does not end with one", () => {
    expect(planAppendRule("a.css", "a{}\n", ".frame-1", [["width", "160px"], ["height", "120px"]])).toEqual(e(4, 4, ".frame-1 {\n  width: 160px;\n  height: 120px;\n}\n"));
    expect(planAppendRule("a.css", "a{}", ".x", [["gap", "16px"]]).text).toBe("\n.x {\n  gap: 16px;\n}\n");
  });
});
