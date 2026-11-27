// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { boxOf, elementAtPath, pathOf } from "../../src/ui/canvas/dom-paths.ts";

const doc = new DOMParser().parseFromString("<html><body><header><a>x</a><nav><a>y</a></nav></header><main></main><script></script></body></html>", "text/html");

describe("dom paths", () => {
  it("finds elements by path", () => {
    expect(elementAtPath(doc, "")).toBe(doc.body);
    expect(elementAtPath(doc, "0.1.0")!.textContent).toBe("y");
    expect(elementAtPath(doc, "2")!.tagName).toBe("SCRIPT");
    expect(elementAtPath(doc, "0.5")).toBeNull();
  });
  it("computes the path of an element", () => {
    expect(pathOf(doc.body)).toBe("");
    expect(pathOf(doc.querySelector("nav a"))).toBe("0.1.0");
    expect(pathOf(doc.querySelector("main"))).toBe("1");
    expect(pathOf(doc.documentElement)).toBeNull();
    expect(pathOf(null)).toBeNull();
  });
  it("rounds the bounding box", () => {
    const el = doc.querySelector("main")!;
    el.getBoundingClientRect = () => ({ left: 10.4, top: 20.6, width: 99.5, height: 40.2 } as DOMRect);
    expect(boxOf(el)).toEqual({ x: 10, y: 21, width: 100, height: 40 });
  });
});
