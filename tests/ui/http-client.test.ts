import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../../src/ui/api/http-client.ts";
import { isMasonError } from "../../src/contracts/errors.ts";

class FakeEventSource {
  static last: FakeEventSource | null = null;
  url: string; closed = false;
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor(url: string) { this.url = url; FakeEventSource.last = this; }
  close() { this.closed = true; }
}
afterEach(() => { vi.unstubAllGlobals(); FakeEventSource.last = null; });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createHttpClient", () => {
  it("posts args to the RPC route and returns the result", async () => {
    const fetchMock = vi.fn(async () => json(200, { result: { tag: "body" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("http://x");
    expect(await client.pageTree("Home")).toEqual({ tag: "body" });
    expect(fetchMock).toHaveBeenCalledWith("http://x/api/rpc/pageTree", { method: "POST", headers: { "content-type": "application/json" }, body: '{"args":["Home"]}' });
  });
  it("turns error bodies into MasonErrors with the server message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { error: { code: "PAGE_NOT_FOUND", message: "Page not found. Nope" } })));
    const error = await createHttpClient("").pageTree("Nope").catch((e: unknown) => e);
    expect(isMasonError(error)).toBe(true);
    expect(error).toMatchObject({ code: "PAGE_NOT_FOUND", message: "Page not found. Nope" });
  });
  it("uses a plain Error for unknown codes and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(500, { error: { code: "INTERNAL", message: "boom" } })));
    await expect(createHttpClient("").templates()).rejects.toThrow("boom");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(createHttpClient("").templates()).rejects.toThrow("Could not reach Mason. Is it still running?");
  });
  it("shares one event stream and closes it after the last listener leaves", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const client = createHttpClient("http://x");
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = client.subscribe((e) => a.push(e));
    const offB = client.subscribe((e) => b.push(e));
    const source = FakeEventSource.last!;
    expect(source.url).toBe("http://x/api/events");
    source.onmessage!({ data: '{"type":"external-change","files":["a.css"]}' });
    source.onmessage!({ data: "not json" });
    expect(a).toEqual([{ type: "external-change", files: ["a.css"] }]);
    expect(b.length).toBe(1);
    offA();
    expect(source.closed).toBe(false);
    offB();
    expect(source.closed).toBe(true);
  });
});
