import { describe, expect, it } from "vitest";
import { handleRpc } from "../../src/server/http/rpc.ts";
import { createFakeStudio } from "../../src/contracts/fakes.ts";
import { MasonError } from "../../src/contracts/errors.ts";

describe("handleRpc", () => {
  it("calls the studio method with the args and wraps the result", async () => {
    const studio = createFakeStudio({ pageTree: async (page) => ({ page } as never) });
    expect(await handleRpc(studio, "pageTree", { args: ["Home"] })).toEqual({ status: 200, body: { result: { page: "Home" } } });
  });
  it("answers 404 UNKNOWN_METHOD for names outside STUDIO_METHODS", async () => {
    const reply = await handleRpc(createFakeStudio(), "constructor", { args: [] });
    expect(reply).toEqual({ status: 404, body: { error: { code: "UNKNOWN_METHOD", message: "Unknown method. constructor" } } });
  });
  it("maps a MasonError to its HTTP status", async () => {
    const studio = createFakeStudio({ pageTree: async () => { throw new MasonError("PAGE_NOT_FOUND", "Nope"); } });
    expect(await handleRpc(studio, "pageTree", { args: ["Nope"] })).toEqual({ status: 404, body: { error: { code: "PAGE_NOT_FOUND", message: "Page not found. Nope" } } });
  });
  it("maps other errors to 500 INTERNAL and missing args to []", async () => {
    const seen: unknown[][] = [];
    const studio = createFakeStudio({
      templates: async (...a: unknown[]) => { seen.push(a); throw new Error("boom"); },
    });
    expect(await handleRpc(studio, "templates", {})).toEqual({ status: 500, body: { error: { code: "INTERNAL", message: "boom" } } });
    expect(seen).toEqual([[]]);
  });
  it("turns an undefined result into null", async () => {
    const studio = createFakeStudio({ templates: async () => undefined as never });
    expect(await handleRpc(studio, "templates", { args: [] })).toEqual({ status: 200, body: { result: null } });
  });
});
