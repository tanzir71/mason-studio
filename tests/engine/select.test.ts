import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { elementSelector, findNode, nextClassName } from "../../src/engine/html/select.ts";
import type { ElementSelector, FindNode, NextClassName } from "../../src/contracts/engine.ts";

const _t: [FindNode, ElementSelector, NextClassName] = [findNode, elementSelector, nextClassName];
void _t;
const { body } = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));

describe("select helpers", () => {
  it("finds nodes by path", () => {
    expect(findNode(body, "")?.tag).toBe("body");
    expect(findNode(body, "1.0.0.1")?.tag).toBe("h1");
    expect(findNode(body, "1.9")).toBeNull();
  });
  it("uses the id, then the classes", () => {
    expect(elementSelector(body, "1.1")).toBe("#menu");
    expect(elementSelector(body, "1.0.0.1")).toBe(".headline");
    expect(elementSelector(body, "1.1.1.0")).toBe(".card");
  });
  it("falls back to the nearest named ancestor, then to a tag chain", () => {
    expect(elementSelector(body, "1.1.0")).toBe("#menu h2");
    expect(elementSelector(body, "0.1.0")).toBe(".nav a");
    expect(elementSelector(body, "1")).toBe("body > main");
  });
  it("throws ELEMENT_NOT_FOUND for a missing path", () => {
    expect(() => elementSelector(body, "7")).toThrow("Element not found.");
  });
  it("picks the next free class name", () => {
    expect(nextClassName(body, "frame")).toBe("frame-1");
    const two = parsePage("a.html", '<body><div class="frame-1"></div><p class="frame-3"></p></body>').body;
    expect(nextClassName(two, "frame")).toBe("frame-2");
  });
});
