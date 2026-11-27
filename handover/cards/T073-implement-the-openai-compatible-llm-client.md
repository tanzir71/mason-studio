# T073: Implement the OpenAI-compatible LLM client

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T073 (build), phase 9 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R32 |

**Create:** `tests/infra/llm.test.ts`

**Modify:** `src/server/infra/llm.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T073`):

1. `npx vitest run tests/infra/llm.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createHttpLlmClient(getAgent)` posts chat completions to the configured endpoint (Ollama, LM Studio, llama.cpp or a hosted API) and returns the reply text.

## Context

Infra module. Replaces the T002 stub. `startMason` (S003) already creates it lazily, so it is only called when someone asks the agent.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface LlmMessage { role: "system" | "user"; content: string }
/** OpenAI-compatible chat completion. Resolves to choices[0].message.content. Network/HTTP errors → LLM_UNAVAILABLE. */
export interface LlmClient { complete(messages: LlmMessage[]): Promise<string> }
/** src/server/infra/llm.ts — POST `${baseUrl}/chat/completions` with { model, messages, response_format: { type: "json_object" } }, Bearer apiKey when not empty. */
export type CreateHttpLlmClient = (getAgent: () => Promise<{ baseUrl: string; model: string; apiKey: string }>) => LlmClient;
```

## Current state

`src/server/infra/llm.ts` is a stub that throws NOT_IMPLEMENTED.

## Steps

1. Replace the whole content of `src/server/infra/llm.ts` with exactly:

```ts
import { MasonError } from "../../contracts/errors.ts";
import type { CreateHttpLlmClient, LlmMessage } from "../../contracts/ports.ts";

export const LLM_TIMEOUT_MS = 60_000;

/** OpenAI-compatible chat completions client (Ollama, LM Studio, llama.cpp, hosted APIs). */
export const createHttpLlmClient: CreateHttpLlmClient = (getAgent) => ({
  async complete(messages: LlmMessage[]): Promise<string> {
    const agent = await getAgent();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (agent.apiKey !== "") headers.authorization = `Bearer ${agent.apiKey}`;
    let res: Response;
    try {
      res = await fetch(`${agent.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST", headers, signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({ model: agent.model, messages, response_format: { type: "json_object" } }),
      });
    } catch (error) {
      throw new MasonError("LLM_UNAVAILABLE", error instanceof Error ? error.message : String(error));
    }
    if (!res.ok) throw new MasonError("LLM_UNAVAILABLE", `HTTP ${res.status}`);
    let body: { choices?: { message?: { content?: unknown } }[] };
    try { body = await res.json(); } catch { throw new MasonError("LLM_BAD_RESPONSE", "not JSON"); }
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new MasonError("LLM_BAD_RESPONSE", "no message content");
    return content;
  },
});
```

2. Create `tests/infra/llm.test.ts` with exactly this content:

```ts
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
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL POST model, messages and response_format json_object to `<baseUrl>/chat/completions`, with a Bearer key only when set. (test: "posts an OpenAI-compatible chat request and returns the message content")
- IF the endpoint is down or answers an error THEN THE SYSTEM SHALL reject with LLM_UNAVAILABLE; a reply without content → LLM_BAD_RESPONSE. (test: "maps HTTP errors, unreachable endpoints and bad bodies")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T073`.
The last line must be `GATE PASS T073`. On `GATE FAIL T073 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T073` prints `GATE PASS T073`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T073: Implement the OpenAI-compatible LLM client
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
