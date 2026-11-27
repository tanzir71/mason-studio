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
