import { MasonError } from "../../contracts/errors.ts";
import { INSPECT_PROPS, SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { AskInput, ProposedChange, Scope } from "../../contracts/model.ts";
import type { LlmMessage, StudioService } from "../../contracts/ports.ts";
import { parseTaste } from "../checks/taste.ts";
import { findNode } from "../html/select.ts";
import { TASTE_FILE } from "./checks-group.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { createInspectGroup } from "./inspect-group.ts";
import { loadPage } from "./page-group.ts";
import { agentSettings } from "./settings-group.ts";

export const ASK_SYSTEM_PROMPT = [
  "You are a careful web designer editing one element of a plain HTML/CSS page through Mason.",
  "Reply with one JSON object only, no prose:",
  '{"summary": "<one short sentence>", "changes": [{"prop": "<property>", "value": "<css value>", "scope": "all" | "tablet" | "mobile"}]}',
  `Allowed properties: ${INSPECT_PROPS.join(", ")}.`,
  "Values are plain CSS values without semicolons or braces. Change as little as possible.",
].join("\n");

/** System + user messages for an ask. Taste rules (design, copy, hard bans) are appended to the system message when present. */
export async function buildAskMessages(ctx: EngineContext, input: AskInput): Promise<LlmMessage[]> {
  const fs = requireFs(ctx);
  const { model } = await loadPage(ctx, input.page);
  const node = findNode(model.body, input.path);
  if (!node) throw new MasonError("ELEMENT_NOT_FOUND", input.path);
  const inspect = await createInspectGroup(ctx).inspect(input.page, input.path);
  const bp = SCOPE_BREAKPOINT[input.scope];
  const current: Record<string, string> = {};
  for (const prop of INSPECT_PROPS) { const v = inspect.props[prop].values[bp]; if (v !== null) current[prop] = v; }
  let system = ASK_SYSTEM_PROMPT;
  if (await fs.exists(TASTE_FILE)) {
    const taste = parseTaste(await fs.readText(TASTE_FILE));
    const rules = ["design", "copy", "hard bans"].filter((k) => taste.sections[k]).map((k) => `${k}:\n${taste.sections[k]}`);
    if (rules.length) system += `\n\nFollow the project's taste rules:\n${rules.join("\n\n")}`;
  }
  const user = JSON.stringify({ request: input.prompt.trim(), page: input.page, scope: input.scope,
    element: { name: node.name, tag: node.tag, selector: inspect.selector, text: node.text }, currentValues: current }, null, 2);
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/** Parses the model reply into a summary and changes for `path`; missing scope → the ask's scope. Bad JSON or shape → LLM_BAD_RESPONSE. */
export function parseAgentReply(reply: string, path: string, scope: Scope): { summary: string; changes: ProposedChange[] } {
  let data: unknown;
  try { data = JSON.parse(reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new MasonError("LLM_BAD_RESPONSE"); }
  const obj = data as { summary?: unknown; changes?: unknown };
  if (typeof obj?.summary !== "string" || !Array.isArray(obj.changes)) throw new MasonError("LLM_BAD_RESPONSE", "missing summary or changes");
  const changes = obj.changes.map((c: { prop?: unknown; value?: unknown; scope?: unknown }) => {
    if (typeof c?.prop !== "string" || (typeof c.value !== "string" && typeof c.value !== "number")) throw new MasonError("LLM_BAD_RESPONSE", "bad change");
    const s = c.scope === "all" || c.scope === "tablet" || c.scope === "mobile" ? c.scope : scope;
    return { path, prop: c.prop as ProposedChange["prop"], value: String(c.value), scope: s };
  });
  return { summary: obj.summary, changes };
}

export function createAgentGroup(ctx: EngineContext, propose: StudioService["propose"]): Pick<StudioService, "askAgent"> {
  return {
    async askAgent(input) {
      if (input.prompt.trim() === "") throw new MasonError("INVALID_INPUT", "The request is empty.");
      const agent = await agentSettings(ctx);
      const reply = await ctx.deps.llm.complete(await buildAskMessages(ctx, input));
      const parsed = parseAgentReply(reply, input.path, input.scope);
      return propose({ source: agent.model, page: input.page, summary: parsed.summary, changes: parsed.changes });
    },
  };
}
