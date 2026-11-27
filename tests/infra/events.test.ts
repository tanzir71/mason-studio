import { describe, expect, it } from "vitest";
import { createEventHub } from "../../src/server/infra/events.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

const ev: MasonEvent = { type: "external-change", files: ["a.css"] };

describe("createEventHub", () => {
  it("delivers events to subscribers in order", () => {
    const hub = createEventHub();
    const seen: string[] = [];
    hub.subscribe(() => seen.push("first"));
    hub.subscribe(() => seen.push("second"));
    hub.emit(ev);
    expect(seen).toEqual(["first", "second"]);
  });
  it("stops delivering after unsubscribe", () => {
    const hub = createEventHub();
    const seen: MasonEvent[] = [];
    const off = hub.subscribe((e) => seen.push(e));
    off();
    hub.emit(ev);
    expect(seen).toEqual([]);
  });
  it("keeps delivering when a listener throws", () => {
    const hub = createEventHub();
    const seen: MasonEvent[] = [];
    hub.subscribe(() => { throw new Error("boom"); });
    hub.subscribe((e) => seen.push(e));
    hub.emit(ev);
    expect(seen).toEqual([ev]);
  });
});
