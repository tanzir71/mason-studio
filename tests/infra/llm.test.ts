import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createHttpLlmClient } from "../../src/server/infra/llm.ts";

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });
async function fakeLlm(status: number, body: string): Promise<{ url: string; seen: { path?: string; auth?: string; body?: unknown } }> {
  const seen: { path?: string; auth?: string; body?: unknown } = {};
  server = createServer((req, res) => {
    let text = "";
    req.on("data", (c) => { text += c; });
    req.on("end", () => {
      seen.path = req.url; seen.auth = req.headers.authorization; seen.body = JSON.parse(text);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body);
    });
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1`, seen };
}

describe("createHttpLlmClient", () => {
  it("posts an OpenAI-compatible chat request and returns the message content", async () => {
    const { url, seen } = await fakeLlm(200, JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const client = createHttpLlmClient(async () => ({ baseUrl: url + "/", model: "qwen", apiKey: "sk-1" }));
    expect(await client.complete([{ role: "user", content: "hi" }])).toBe('{"ok":true}');
    expect(seen).toEqual({ path: "/v1/chat/completions", auth: "Bearer sk-1", body: { model: "qwen", messages: [{ role: "user", content: "hi" }], response_format: { type: "json_object" } } });
  });
  it("sends no authorization header without a key", async () => {
    const { url, seen } = await fakeLlm(200, JSON.stringify({ choices: [{ message: { content: "x" } }] }));
    await createHttpLlmClient(async () => ({ baseUrl: url, model: "m", apiKey: "" })).complete([]);
    expect(seen.auth).toBeUndefined();
  });
  it("maps HTTP errors, unreachable endpoints and bad bodies", async () => {
    const { url } = await fakeLlm(500, "{}");
    await expect(createHttpLlmClient(async () => ({ baseUrl: url, model: "m", apiKey: "" })).complete([])).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
    await expect(createHttpLlmClient(async () => ({ baseUrl: "http://127.0.0.1:1", model: "m", apiKey: "" })).complete([])).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
    server?.close();
    const ok = await fakeLlm(200, JSON.stringify({ choices: [] }));
    await expect(createHttpLlmClient(async () => ({ baseUrl: ok.url, model: "m", apiKey: "" })).complete([])).rejects.toMatchObject({ code: "LLM_BAD_RESPONSE" });
  });
});
