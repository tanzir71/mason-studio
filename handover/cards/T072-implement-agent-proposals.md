# T072: Implement agent proposals

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T072 (build), phase 9 |
| Depends on | T040, T067 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R31 |

**Create:** `src/engine/studio/proposal-group.ts`, `tests/engine/proposal-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T072`):

1. `npx vitest run tests/engine/proposal-group.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`propose`, `proposals`, `acceptProposal` and `rejectProposal` keep agent changes as pending proposals with labels, current values and taste blocks, and apply accepted ones as one undo step.

## Context

Engine module, studio area. This is how agents edit safely: nothing is written until a person accepts. Changes that match a hard ban are flagged and skipped unless the person accepts all. Registers in `create-studio.ts`.

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export interface ProposedChange { path: ElementPath; prop: InspectProp; value: string; scope: Scope }
export interface ProposalInput { source: string; page: string; summary: string; changes: ProposedChange[] }
export interface ProposalChange extends ProposedChange { label: string; from: string | null; blocked: CheckFinding | null }
export interface Proposal { id: string; source: string; page: string; summary: string; createdAt: number; status: ProposalStatus; changes: ProposalChange[] }
/** Human labels used in proposals and the Design panel ("Headline size"). */
export const PROP_LABELS: Record<InspectProp, string> = {
  "display": "display", "flex-direction": "direction", "gap": "gap", "justify-content": "justify", "align-items": "align",
  "grid-template-columns": "columns", "width": "width", "height": "height", "max-width": "max width", "padding": "padding",
  "margin": "margin", "font-family": "font", "font-weight": "weight", "font-size": "size", "line-height": "line height",
  "letter-spacing": "letter spacing", "text-align": "alignment", "color": "color", "background-color": "fill",
  "border": "stroke", "border-radius": "radius", "opacity": "opacity", "box-shadow": "shadow",
};
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

`src/engine/studio/style-group.ts` exports `planStyles(ctx, page, items)`; `write.ts` exports `commitChanges`; `checks-group.ts` exports `TASTE_FILE`; `src/engine/checks/taste.ts` exports `parseTaste`, `checkBans`. `ctx.proposals` (newest first) exists on the EngineContext.

## Steps

1. Create `src/engine/studio/proposal-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS, PROP_LABELS, SCOPE_BREAKPOINT } from "../../contracts/model.ts";
import type { InspectProp, Proposal, ProposalChange, ProposalInput, Scope } from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { resolveCascade } from "../css/cascade.ts";
import { checkBans, parseTaste } from "../checks/taste.ts";
import { findNode } from "../html/select.ts";
import { TASTE_FILE } from "./checks-group.ts";
import { requireFs } from "./context.ts";
import type { EngineContext } from "./context.ts";
import { loadPage } from "./page-group.ts";
import { planStyles } from "./style-group.ts";
import { commitChanges } from "./write.ts";

export const MAX_PROPOSAL_CHANGES = 20;
const SCOPES: readonly Scope[] = ["all", "tablet", "mobile"];

/** Find a proposal by id or PROPOSAL_NOT_FOUND. */
export function requireProposal(ctx: EngineContext, id: string): Proposal {
  const p = ctx.proposals.find((x) => x.id === id);
  if (!p) throw new MasonError("PROPOSAL_NOT_FOUND", id);
  return p;
}

export function createProposalGroup(ctx: EngineContext): Pick<StudioService, "proposals" | "propose" | "acceptProposal" | "rejectProposal"> {
  const emit = (proposal: Proposal) => ctx.deps.events.emit({ type: "proposal", proposal });
  return {
    async proposals() { return [...ctx.proposals]; },
    /**
     * Validates (summary and source not empty; 1..20 changes; prop in INSPECT_PROPS; scope all/tablet/mobile; value not
     * empty and without ; { }; path exists) → INVALID_INPUT / ELEMENT_NOT_FOUND. Each change gets label
     * `${element name} ${PROP_LABELS[prop]}`, from = the current winning value at the scope's width (or null), and
     * blocked = the first taste ban matching `${prop}: ${value}` (null without .mason/taste.md). Stored newest first.
     */
    async propose(input: ProposalInput) {
      const fs = requireFs(ctx);
      const source = input.source.trim();
      const summary = input.summary.trim();
      if (source === "" || summary === "") throw new MasonError("INVALID_INPUT", "A proposal needs a source and a summary.");
      if (!Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > MAX_PROPOSAL_CHANGES) {
        throw new MasonError("INVALID_INPUT", `A proposal needs 1 to ${MAX_PROPOSAL_CHANGES} changes.`);
      }
      const { model, sheets } = await loadPage(ctx, input.page);
      const profile = (await fs.exists(TASTE_FILE)) ? parseTaste(await fs.readText(TASTE_FILE)) : null;
      const changes: ProposalChange[] = input.changes.map((c) => {
        if (!(INSPECT_PROPS as readonly string[]).includes(c.prop)) throw new MasonError("INVALID_INPUT", `Unknown property ${c.prop}.`);
        if (!SCOPES.includes(c.scope)) throw new MasonError("INVALID_INPUT", `Unknown scope ${c.scope}.`);
        const value = String(c.value ?? "").trim();
        if (value === "" || /[;{}]/.test(value)) throw new MasonError("INVALID_INPUT", `Bad value for ${c.prop}.`);
        const node = findNode(model.body, c.path);
        const el = model.matcher(c.path);
        if (!node || !el) throw new MasonError("ELEMENT_NOT_FOUND", c.path);
        const width = BREAKPOINTS.find((b) => b.id === SCOPE_BREAKPOINT[c.scope])!.width;
        const from = resolveCascade(sheets, el, c.prop, width).find((e) => e.winning)?.declaration.value ?? null;
        const blocked = profile ? checkBans(profile, `${c.prop}: ${value}`, { file: null, line: null, path: c.path })[0] ?? null : null;
        return { path: c.path, prop: c.prop as InspectProp, value, scope: c.scope, label: `${node.name} ${PROP_LABELS[c.prop as InspectProp]}`, from, blocked };
      });
      const proposal: Proposal = { id: ctx.deps.newId(), source, page: input.page, summary, createdAt: ctx.deps.now(), status: "pending", changes };
      ctx.proposals.unshift(proposal);
      emit(proposal);
      return proposal;
    },
    /** Applies the pending proposal's changes (blocked ones only when includeBlocked) as ONE undo step, message `Applied ${n} changes from ${source}`. */
    async acceptProposal(id, includeBlocked) {
      const proposal = requireProposal(ctx, id);
      if (proposal.status !== "pending") throw new MasonError("PROPOSAL_CLOSED", id);
      const chosen = proposal.changes.filter((c) => includeBlocked || c.blocked === null);
      if (chosen.length === 0) throw new MasonError("INVALID_INPUT", "Every change is blocked.");
      const plan = await planStyles(ctx, proposal.page, chosen);
      const noun = chosen.length === 1 ? "change" : "changes";
      const result = await commitChanges(ctx, plan.changes, { message: `Applied ${chosen.length} ${noun} from ${proposal.source}` });
      proposal.status = "accepted";
      emit(proposal);
      return result;
    },
    async rejectProposal(id) {
      const proposal = requireProposal(ctx, id);
      if (proposal.status !== "pending") throw new MasonError("PROPOSAL_CLOSED", id);
      proposal.status = "rejected";
      emit(proposal);
      return proposal;
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createProposalGroup } from "./proposal-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createProposalGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/proposal-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import type { ProposalInput } from "../../src/contracts/model.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function setup() {
  const deps = createTestDeps({ "/p": fixtureFiles() });
  const s = createStudio(deps);
  await s.openProject("/p");
  deps.events.emitted.length = 0;
  return { s, deps, fs: deps.openFs("/p") };
}
const input: ProposalInput = { source: "Claude Code", page: "Home", summary: "Tighter tablet headline", changes: [
  { path: "1.0.0.1", prop: "font-size", value: "30px", scope: "tablet" },
  { path: "1.0.0.0", prop: "letter-spacing", value: "0.18em", scope: "tablet" },
  { path: "1.0", prop: "background-color", value: "#7c3aed", scope: "all" },
] };

describe("proposal group", () => {
  it("labels changes, records current values, blocks taste bans and emits the proposal", async () => {
    const { s, deps } = await setup();
    const p = await s.propose(input);
    expect([p.id, p.status, p.createdAt]).toEqual(["id-1", "pending", 1_002_000]);
    expect(p.changes.map((c) => [c.label, c.from, c.blocked?.title ?? null])).toEqual([
      ["Headline size", "32px", null], ["Eyebrow letter spacing", "0.12em", null], ["Hero fill", null, "No stock AI purple"],
    ]);
    expect(deps.events.emitted).toEqual([{ type: "proposal", proposal: p }]);
    expect((await s.proposals()).map((x) => x.id)).toEqual(["id-1"]);
  });
  it("writes nothing until accepted, then applies the allowed changes as one step", async () => {
    const { s, fs } = await setup();
    const before = await fs.readText("styles.css");
    const p = await s.propose(input);
    expect(await fs.readText("styles.css")).toBe(before);
    const r = await s.acceptProposal(p.id, false);
    expect(r).toMatchObject({ files: ["styles.css"], message: "Applied 2 changes from Claude Code" });
    const css = await fs.readText("styles.css");
    expect(css).toContain("font-size: 30px;");
    expect(css).toContain("letter-spacing: 0.18em;");
    expect(css).not.toContain("#7c3aed");
    expect((await s.proposals())[0].status).toBe("accepted");
    await s.undo();
    expect(await fs.readText("styles.css")).toBe(before);
  });
  it("rejects proposals and refuses closed ones", async () => {
    const { s } = await setup();
    const p = await s.propose(input);
    expect((await s.rejectProposal(p.id)).status).toBe("rejected");
    await expect(s.acceptProposal(p.id, false)).rejects.toMatchObject({ code: "PROPOSAL_CLOSED" });
    await expect(s.rejectProposal("nope")).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" });
  });
  it("validates every change", async () => {
    const { s } = await setup();
    const bad = (change: object) => s.propose({ ...input, changes: [change as never] });
    await expect(bad({ path: "1.0.0.1", prop: "transform", value: "none", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "1.0.0.1", prop: "color", value: "red; x", scope: "all" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "1.0.0.1", prop: "color", value: "red", scope: "print" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(bad({ path: "9.9", prop: "color", value: "red", scope: "all" })).rejects.toMatchObject({ code: "ELEMENT_NOT_FOUND" });
    await expect(s.propose({ ...input, changes: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- WHEN a proposal is filed THE SYSTEM SHALL label each change, record its current value, block taste bans and emit a proposal event. (test: "labels changes, records current values, blocks taste bans and emits the proposal")
- WHEN accepted THE SYSTEM SHALL write only the allowed changes as one undo step. (test: "writes nothing until accepted, then applies the allowed changes as one step")
- IF a change has an unknown property, a bad value or scope, or a missing element THEN THE SYSTEM SHALL reject the proposal. (test: "validates every change")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T072`.
The last line must be `GATE PASS T072`. On `GATE FAIL T072 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T072` prints `GATE PASS T072`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T072: Implement agent proposals
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
