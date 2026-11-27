# T074: Ask the agent about a layer

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T074 (build), phase 9 |
| Depends on | T071, T072, T039 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R32 |

**Create:** `src/engine/studio/agent-group.ts`, `tests/engine/agent-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T074`):

1. `npx vitest run tests/engine/agent-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`askAgent(input)` sends the element's context and the project's taste rules to the model and files its JSON reply as a proposal.

## Context

Engine module, studio area. The model only ever proposes; it never writes. Registration passes the studio's own `propose` so agent replies go through the same validation as MCP proposals.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface AskInput { page: string; path: ElementPath; prompt: string; scope: Scope }
export interface ProposedChange { path: ElementPath; prop: InspectProp; value: string; scope: Scope }
```

```ts
// src/contracts/ports.ts
/** OpenAI-compatible chat completion. Resolves to choices[0].message.content. Network/HTTP errors → LLM_UNAVAILABLE. */
export interface LlmClient { complete(messages: LlmMessage[]): Promise<string> }
/**
 * Everything the UI, HTTP and MCP layers can do. Implemented by createStudio (src/engine/studio/).
 * Every method rejects with MasonError on failure. Methods that need an open project reject with NO_PROJECT.
 * Every write records one undo step, increments the revision and emits { type: "written" }.
 */
export interface StudioService {
  /** Opens a folder containing at least one top-level .html file (else NOT_A_PROJECT); records it in recent projects; emits project-opened. */
  openProject(root: string): Promise<ProjectInfo>;
  /** Copies templates/<template>/ into root (must be missing or empty, else FOLDER_NOT_EMPTY), then openProject(root). */
  createProject(root: string, template: TemplateId): Promise<ProjectInfo>;
  currentProject(): Promise<ProjectInfo>;
  recentProjects(): Promise<RecentProject[]>;          // newest first, max 8
  templates(): Promise<TemplateInfo[]>;                 // order: landing, portfolio, docs, blank
  /** Creates `${slug}.html` from the first page's <head> with an empty <main>; PAGE_EXISTS when present. */
  createPage(name: string): Promise<PageInfo>;
  pageTree(page: string): Promise<ElementNode>;         // body node; PAGE_NOT_FOUND
  inspect(page: string, path: ElementPath): Promise<InspectResult>;
  applyStyle(change: StyleChange): Promise<WriteResult>;
  resetStyle(page: string, path: ElementPath, prop: string, scope: Scope): Promise<WriteResult>;
  insertElement(page: string, parentPath: ElementPath, index: number, kind: InsertKind): Promise<WriteResult>;
  editText(page: string, path: ElementPath, text: string): Promise<WriteResult>;
  removeElement(page: string, path: ElementPath): Promise<WriteResult>;
  moveElement(page: string, path: ElementPath, toIndex: number): Promise<WriteResult>;
  wrapInStack(page: string, path: ElementPath): Promise<WriteResult>;
  undo(): Promise<WriteResult>;                          // NOTHING_TO_UNDO
  redo(): Promise<WriteResult>;                          // NOTHING_TO_REDO
  readFile(path: string): Promise<FileText>;
  writeFile(path: string, text: string): Promise<WriteResult>;
  tokens(): Promise<TokenSet>;                           // tokens.json at the root, or { tokens: [], file: null }
  importTokens(format: TokenFormat, json: string): Promise<TokenSet>; // writes tokens.json (DTCG) and tokens.css
  exportTokens(): Promise<WriteResult>;                  // rewrites tokens.css from tokens.json
  checks(page: string): Promise<CheckReport>;
  gitStatus(): Promise<GitStatus>;
  commit(message: string): Promise<GitStatus>;           // empty message → INVALID_INPUT; failure → GIT_FAILED
  proposals(): Promise<Proposal[]>;                       // newest first
  propose(input: ProposalInput): Promise<Proposal>;      // validates, labels, taste-checks; emits { type: "proposal" }
  acceptProposal(id: string, includeBlocked: boolean): Promise<WriteResult>;
  rejectProposal(id: string): Promise<Proposal>;
  askAgent(input: AskInput): Promise<Proposal>;          // LLM → propose(); source = settings.agent.model
  settings(): Promise<Settings>;                          // agent.apiKey is always "" here; hasApiKey tells if one is stored
  saveSettings(settings: Settings): Promise<Settings>;   // agent.apiKey "" keeps the stored key
}
```

## Current state

`settings-group.ts` exports `agentSettings(ctx)`; `inspect-group.ts` exports `createInspectGroup`; `checks-group.ts` exports `TASTE_FILE`. `create-studio.ts` builds `studio` as a `Record<string, unknown>`.

## Steps

1. Create `src/engine/studio/agent-group.ts` with exactly this content:

````ts
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
````

2. In `src/engine/studio/create-studio.ts` insert `import { createAgentGroup } from "./agent-group.ts";` directly above `// @seam:imports`, and directly above `  // @seam:groups` insert:

```ts
  Object.assign(studio, createAgentGroup(ctx, (input) => (studio as unknown as StudioService).propose(input)));
```

3. Create `tests/engine/agent-group.test.ts` with exactly this content:

````ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { parseAgentReply } from "../../src/engine/studio/agent-group.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

describe("agent group", () => {
  it("parses replies, defaulting the scope and accepting fenced JSON", () => {
    expect(parseAgentReply('```json\n{"summary":"s","changes":[{"prop":"font-size","value":30}]}\n```', "1.0", "tablet")).toEqual({
      summary: "s", changes: [{ path: "1.0", prop: "font-size", value: "30", scope: "tablet" }],
    });
    expect(() => parseAgentReply("Sure! Here you go", "1", "all")).toThrow("The agent reply was not valid JSON.");
    expect(() => parseAgentReply('{"changes": []}', "1", "all")).toThrow("The agent reply was not valid JSON.");
  });
  it("asks the model with context and taste rules, then files a proposal", async () => {
    const deps = createTestDeps({ "/p": fixtureFiles() });
    deps.llm.replies.push(JSON.stringify({ summary: "Smaller on tablets", changes: [{ prop: "font-size", value: "30px" }] }));
    const studio = createStudio(deps);
    await studio.openProject("/p");
    const p = await studio.askAgent({ page: "Home", path: "1.0.0.1", prompt: "Make it smaller", scope: "tablet" });
    expect([p.source, p.summary, p.changes[0].label, p.changes[0].from, p.changes[0].scope]).toEqual(["qwen2.5-coder:7b", "Smaller on tablets", "Headline size", "32px", "tablet"]);
    const [system, user] = deps.llm.requests[0];
    expect(system.role).toBe("system");
    expect(system.content).toContain("Allowed properties: display, flex-direction");
    expect(system.content).toContain("No stock AI purple");
    const sent = JSON.parse(user.content);
    expect(sent).toMatchObject({ request: "Make it smaller", scope: "tablet", element: { name: "Headline", tag: "h1", selector: ".headline" } });
    expect(sent.currentValues["font-size"]).toBe("32px");
  });
  it("rejects an empty request and passes LLM errors through", async () => {
    const studio = createStudio(createTestDeps({ "/p": fixtureFiles() }));
    await studio.openProject("/p");
    await expect(studio.askAgent({ page: "Home", path: "1", prompt: " ", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(studio.askAgent({ page: "Home", path: "1", prompt: "x", scope: "all" })).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
  });
});
````

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL parse JSON replies (also fenced), defaulting each change's scope to the ask's scope. (test: "parses replies, defaulting the scope and accepting fenced JSON")
- WHEN asked THE SYSTEM SHALL send the allowed properties, taste rules, element and current values, and file the reply as a proposal from the model. (test: "asks the model with context and taste rules, then files a proposal")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T074`.
The last line must be `GATE PASS T074`. On `GATE FAIL T074 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T074` prints `GATE PASS T074`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T074: Ask the agent about a layer
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
