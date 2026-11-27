# T075: Implement the MCP tools

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T075 (build), phase 9 |
| Depends on | T072, T067, T055 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R33 |

**Create:** `src/server/mcp/tools.ts`, `tests/mcp/tools.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T075`):

1. `npx vitest run tests/mcp/tools.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`runTool(studio, name, args)` returns the data of each of the seven MCP tools in MCP_TOOLS.

## Context

MCP module. Tools only read or propose; `propose_style_changes` never writes. The handler (T076) wraps the data as text content.

## Contracts (do not modify)

```ts
// src/contracts/mcp.ts
export type McpToolName = "list_pages" | "get_page_structure" | "get_element" | "propose_style_changes" | "get_proposal" | "list_tokens" | "check_page";
export const MCP_TOOLS: readonly McpToolDef[] = [
  { name: "list_pages", description: "List the pages of the open project. data: [{ name, file, title }]",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_page_structure", description: "Element tree of a page without script/style/meta elements. data: { path, tag, name, kind, children }",
    inputSchema: { type: "object", properties: { page }, required: ["page"], additionalProperties: false } },
  { name: "get_element", description: "Selector and declared style values of one element at Desktop, Tablet and Mobile. data: { name, tag, selector, values: { [prop]: { desktop, tablet, mobile } } } (only props with a value)",
    inputSchema: { type: "object", properties: { page, path }, required: ["page", "path"], additionalProperties: false } },
  { name: "propose_style_changes", description: "Propose style changes for review. Nothing is written until a person accepts. scope: all | tablet | mobile. data: { proposal_id, blocked, message }",
    inputSchema: { type: "object", required: ["page", "summary", "changes"], additionalProperties: false, properties: {
      page, summary: { type: "string" }, agent_name: { type: "string", description: "Your name, shown on the review card" },
      changes: { type: "array", minItems: 1, items: { type: "object", required: ["path", "prop", "value", "scope"], additionalProperties: false,
        properties: { path, prop: { type: "string" }, value: { type: "string" }, scope: { type: "string", enum: ["all", "tablet", "mobile"] } } } } } } },
  { name: "get_proposal", description: "Status of a proposal. data: { id, status, changes: [{ label, value, blocked }] }",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "list_tokens", description: "Design tokens of the project. data: [{ name, type, value }]",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "check_page", description: "Run taste, accessibility and token checks for a page. data: [{ severity, title, detail }]",
    inputSchema: { type: "object", properties: { page }, required: ["page"], additionalProperties: false } },
];
/** propose_style_changes data.message: */
export const MCP_PROPOSAL_MESSAGE = "Proposal {id} is waiting for review in Mason. Nothing was written.";
```

```ts
// src/contracts/ports.ts
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

`src/server/mcp/` has only the `handler.ts` stub.

## Steps

1. Create `src/server/mcp/tools.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { INSPECT_PROPS, NON_VISUAL_TAGS } from "../../contracts/model.ts";
import type { ElementNode } from "../../contracts/model.ts";
import { MCP_PROPOSAL_MESSAGE } from "../../contracts/mcp.ts";
import type { McpToolName } from "../../contracts/mcp.ts";
import type { StudioService } from "../../contracts/ports.ts";

type Args = Record<string, unknown>;
export interface StructureNode { path: string; tag: string; name: string; kind: string; children: StructureNode[] }

function str(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v === "") throw new MasonError("INVALID_INPUT", `"${key}" must be a non-empty string.`);
  return v;
}

/** Element tree without NON_VISUAL_TAGS, keeping only path, tag, name, kind and children. */
export function structureOf(node: ElementNode): StructureNode {
  return { path: node.path, tag: node.tag, name: node.name, kind: node.kind,
    children: node.children.filter((c) => !NON_VISUAL_TAGS.includes(c.tag)).map(structureOf) };
}

/** The data each MCP tool returns (see MCP_TOOLS descriptions). */
export async function runTool(studio: StudioService, name: McpToolName, args: Args): Promise<unknown> {
  switch (name) {
    case "list_pages":
      return (await studio.currentProject()).pages.map((p) => ({ name: p.name, file: p.file, title: p.title }));
    case "get_page_structure":
      return structureOf(await studio.pageTree(str(args, "page")));
    case "get_element": {
      const r = await studio.inspect(str(args, "page"), str(args, "path"));
      const values: Record<string, unknown> = {};
      for (const prop of INSPECT_PROPS) {
        const v = r.props[prop].values;
        if (v.desktop !== null || v.tablet !== null || v.mobile !== null) values[prop] = v;
      }
      return { name: r.name, tag: r.tag, selector: r.selector, values };
    }
    case "propose_style_changes": {
      const agent = typeof args.agent_name === "string" && args.agent_name.trim() !== "" ? args.agent_name.trim() : "MCP agent";
      const changes = Array.isArray(args.changes) ? args.changes as never[] : [];
      const p = await studio.propose({ source: agent, page: str(args, "page"), summary: str(args, "summary"), changes });
      return { proposal_id: p.id, blocked: p.changes.filter((c) => c.blocked).map((c) => ({ label: c.label, reason: c.blocked!.title })),
        message: MCP_PROPOSAL_MESSAGE.replace("{id}", p.id) };
    }
    case "get_proposal": {
      const id = str(args, "id");
      const p = (await studio.proposals()).find((x) => x.id === id);
      if (!p) throw new MasonError("PROPOSAL_NOT_FOUND", id);
      return { id: p.id, status: p.status, changes: p.changes.map((c) => ({ label: c.label, value: c.value, blocked: c.blocked !== null })) };
    }
    case "list_tokens":
      return (await studio.tokens()).tokens.map((t) => ({ name: t.name, type: t.type, value: t.value }));
    case "check_page":
      return (await studio.checks(str(args, "page"))).findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail }));
  }
}
```

2. Create `tests/mcp/tools.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { runTool, structureOf } from "../../src/server/mcp/tools.ts";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function studio() {
  const s = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await s.openProject("/p");
  return s;
}

describe("MCP tools", () => {
  it("lists pages and the visible structure", async () => {
    const s = await studio();
    expect(await runTool(s, "list_pages", {})).toEqual([{ name: "Home", file: "index.html", title: "Northfield Coffee" }, { name: "Menu", file: "menu.html", title: "Menu" }]);
    const tree = structureOf(await s.pageTree("Home"));
    expect(tree.children.map((c) => c.name)).toEqual(["Header", "Main", "Footer"]);
    expect(Object.keys(tree.children[0])).toEqual(["path", "tag", "name", "kind", "children"]);
  });
  it("describes an element with only the properties that have values", async () => {
    const data = await runTool(await studio(), "get_element", { page: "Home", path: "1.0.0.1" }) as { values: Record<string, unknown>; selector: string };
    expect(data.selector).toBe(".headline");
    expect(data.values["font-size"]).toEqual({ desktop: "40px", tablet: "32px", mobile: "28px" });
    expect(data.values.padding).toBeUndefined();
  });
  it("files proposals with the agent name and reports their status", async () => {
    const s = await studio();
    const data = await runTool(s, "propose_style_changes", { page: "Home", summary: "Purple hero", agent_name: "Claude Code",
      changes: [{ path: "1.0", prop: "background-color", value: "#6e56cf", scope: "all" }] }) as { proposal_id: string; blocked: unknown[]; message: string };
    expect(data).toEqual({ proposal_id: "id-1", blocked: [{ label: "Hero fill", reason: "No stock AI purple" }], message: "Proposal id-1 is waiting for review in Mason. Nothing was written." });
    expect((await s.proposals())[0].source).toBe("Claude Code");
    expect(await runTool(s, "get_proposal", { id: "id-1" })).toEqual({ id: "id-1", status: "pending", changes: [{ label: "Hero fill", value: "#6e56cf", blocked: true }] });
  });
  it("lists tokens and check findings, and rejects missing arguments", async () => {
    const s = await studio();
    expect((await runTool(s, "list_tokens", {}) as unknown[])[0]).toEqual({ name: "color.cream", type: "color", value: "#f3eee4" });
    expect((await runTool(s, "check_page", { page: "Home" }) as { severity: string }[]).length).toBe(6);
    await expect(runTool(s, "get_page_structure", {})).rejects.toThrow('Invalid input. "page" must be a non-empty string.');
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL list pages and the visible element structure. (test: "lists pages and the visible structure")
- WHEN an agent proposes changes THE SYSTEM SHALL file a proposal under the agent's name and return its id, blocked changes and the review message. (test: "files proposals with the agent name and reports their status")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T075`.
The last line must be `GATE PASS T075`. On `GATE FAIL T075 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/mcp/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T075` prints `GATE PASS T075`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T075: Implement the MCP tools
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
