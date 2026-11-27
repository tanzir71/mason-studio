# T039: Implement inspect for an element

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T039 (build), phase 4 |
| Depends on | T034, T009, T012 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R18, R22 |

**Create:** `src/engine/studio/inspect-group.ts`, `tests/engine/inspect-group.test.ts`

**Modify:** `src/engine/studio/create-studio.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T039`):

1. `npx vitest run tests/engine/inspect-group.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`inspect(page, path)` returns the element's name, tag, selector, winning value of every INSPECT_PROPS property at each breakpoint and the cascade rows per breakpoint.

## Context

Engine module, studio area. The Design panel reads `props`; the Inspect panel (phase 7) reads `rules`. Registers in `create-studio.ts` (same module).

## Contracts (do not modify)

```ts
// src/contracts/model.ts
export const INSPECT_PROPS = [
  "display", "flex-direction", "gap", "justify-content", "align-items", "grid-template-columns",
  "width", "height", "max-width", "padding", "margin",
  "font-family", "font-weight", "font-size", "line-height", "letter-spacing", "text-align",
  "color", "background-color", "border", "border-radius", "opacity", "box-shadow",
] as const;
export interface PropInfo {
  values: Record<BreakpointId, string | null>;      // winning declared value at each breakpoint width
  winners: Record<BreakpointId, RuleRef | null>;    // rule of that winning declaration
  overriddenAt: BreakpointId[];                     // tablet/mobile whose winner sits in "(max-width: <that maxWidth>px)"
}
export interface CascadeRow {
  rule: RuleRef; specificity: Specificity; applies: boolean;
  declarations: { prop: string; value: string; status: "winning" | "overridden" }[];
}
export interface InspectResult {
  page: string; path: ElementPath; name: string; tag: string; selector: string;
  props: Record<InspectProp, PropInfo>;
  rules: Record<BreakpointId, CascadeRow[]>;
}
export interface RuleRef { file: string; line: number; selector: string; media: string | null }
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

`src/engine/studio/page-group.ts` exports `loadPage(ctx, name)` → `{ info, html, model, sheets }`. `src/engine/html/select.ts` exports `findNode`, `elementSelector`. `src/engine/css/cascade.ts` exports `matchingRules`, `resolveCascade`.

## Steps

1. Create `src/engine/studio/inspect-group.ts` with exactly this content:

```ts
import { MasonError } from "../../contracts/errors.ts";
import { BREAKPOINTS, INSPECT_PROPS } from "../../contracts/model.ts";
import type {
  BreakpointId, CascadeRow, CssRule, CssSheet, ElementMatcher, ElementPath, InspectProp, InspectResult, PropInfo, RuleRef,
} from "../../contracts/model.ts";
import type { StudioService } from "../../contracts/ports.ts";
import { matchingRules, resolveCascade } from "../css/cascade.ts";
import { elementSelector, findNode } from "../html/select.ts";
import { loadPage } from "./page-group.ts";
import type { EngineContext } from "./context.ts";

export function ruleRef(rule: CssRule): RuleRef {
  return { file: rule.file, line: rule.line, selector: rule.selector, media: rule.media };
}

/** PropInfo for one property: winning value and rule at each breakpoint width, and the overridden breakpoints. */
export function propInfo(sheets: CssSheet[], el: ElementMatcher, prop: string): PropInfo {
  const values = {} as Record<BreakpointId, string | null>;
  const winners = {} as Record<BreakpointId, RuleRef | null>;
  for (const bp of BREAKPOINTS) {
    const win = resolveCascade(sheets, el, prop, bp.width).find((e) => e.winning);
    values[bp.id] = win ? win.declaration.value : null;
    winners[bp.id] = win ? ruleRef(win.rule) : null;
  }
  const overriddenAt = BREAKPOINTS.filter((bp) => bp.maxWidth !== null && winners[bp.id]?.media === `(max-width: ${bp.maxWidth}px)`).map((bp) => bp.id);
  return { values, winners, overriddenAt };
}

/** Cascade rows at one width: every matching rule, each declaration marked winning or overridden. */
export function cascadeRows(sheets: CssSheet[], el: ElementMatcher, width: number): CascadeRow[] {
  const matches = matchingRules(sheets, el, width);
  const winningKeys = new Set<string>();
  const props = new Set(matches.flatMap((m) => m.rule.declarations.map((d) => d.prop)));
  for (const prop of props) {
    const win = resolveCascade(sheets, el, prop, width).find((e) => e.winning);
    if (win) winningKeys.add(`${win.rule.file}:${win.rule.index}:${win.declIndex}`);
  }
  return matches.map((m) => ({
    rule: ruleRef(m.rule), specificity: m.specificity, applies: m.applies,
    declarations: m.rule.declarations.map((d, i) => ({
      prop: d.prop, value: d.value,
      status: winningKeys.has(`${m.rule.file}:${m.rule.index}:${i}`) ? "winning" as const : "overridden" as const,
    })),
  }));
}

export function createInspectGroup(ctx: EngineContext): Pick<StudioService, "inspect"> {
  return {
    async inspect(page: string, path: ElementPath): Promise<InspectResult> {
      const { model, sheets } = await loadPage(ctx, page);
      const node = findNode(model.body, path);
      const el = model.matcher(path);
      if (!node || !el) throw new MasonError("ELEMENT_NOT_FOUND", path);
      const props = {} as Record<InspectProp, PropInfo>;
      for (const prop of INSPECT_PROPS) props[prop] = propInfo(sheets, el, prop);
      const rules = {} as Record<BreakpointId, CascadeRow[]>;
      for (const bp of BREAKPOINTS) rules[bp.id] = cascadeRows(sheets, el, bp.width);
      return { page, path, name: node.name, tag: node.tag, selector: elementSelector(model.body, path), props, rules };
    },
  };
}
```

2. In `src/engine/studio/create-studio.ts` insert `import { createInspectGroup } from "./inspect-group.ts";` directly above `// @seam:imports` and `  Object.assign(studio, createInspectGroup(ctx));` directly above `  // @seam:groups`. Keep both anchors.

3. Create `tests/engine/inspect-group.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/engine/studio/create-studio.ts";
import { createTestDeps } from "../../src/contracts/fakes.ts";
import { fixtureFiles } from "../helpers/fixture.ts";

async function studio() {
  const s = createStudio(createTestDeps({ "/p": fixtureFiles() }));
  await s.openProject("/p");
  return s;
}

describe("inspect group", () => {
  it("reports name, tag, selector and font-size per breakpoint", async () => {
    const r = await (await studio()).inspect("Home", "1.0.0.1");
    expect([r.name, r.tag, r.selector]).toEqual(["Headline", "h1", ".headline"]);
    expect(r.props["font-size"].values).toEqual({ desktop: "40px", tablet: "32px", mobile: "28px" });
    expect(r.props["font-size"].overriddenAt).toEqual(["tablet", "mobile"]);
    expect(r.props["font-size"].winners.tablet).toEqual({ file: "styles.css", line: 58, selector: ".hero h1", media: "(max-width: 768px)" });
    expect(r.props.color.values.desktop).toBe("#1e2a22");
    expect(r.props.padding.values).toEqual({ desktop: null, tablet: null, mobile: null });
  });
  it("lists cascade rows with winning and overridden declarations", async () => {
    const r = await (await studio()).inspect("Home", "1.0.0.1");
    const tablet = r.rules.tablet.map((row) => [row.rule.selector, row.rule.media, row.applies]);
    expect(tablet).toEqual([[".hero h1", "(max-width: 768px)", true], [".hero h1", null, true], [".hero h1", "(max-width: 375px)", false]]);
    const base = r.rules.tablet[1].declarations.find((d) => d.prop === "font-size");
    expect(base).toEqual({ prop: "font-size", value: "40px", status: "overridden" });
    expect(r.rules.desktop[0].declarations.find((d) => d.prop === "font-size")!.status).toBe("winning");
  });
  it("rejects a missing element", async () => {
    await expect((await studio()).inspect("Home", "9.9")).rejects.toMatchObject({ code: "ELEMENT_NOT_FOUND" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL report each property's winning value and rule per breakpoint and the breakpoints whose winner is their own max-width rule. (test: "reports name, tag, selector and font-size per breakpoint")
- THE SYSTEM SHALL list matching rules per breakpoint with each declaration marked winning or overridden. (test: "lists cascade rows with winning and overridden declarations")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T039`.
The last line must be `GATE PASS T039`. On `GATE FAIL T039 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T039` prints `GATE PASS T039`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T039: Implement inspect for an element
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
