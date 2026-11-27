# T007: Implement friendly layer names and kinds

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T007 (build), phase 2 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R5 |

**Create:** `src/engine/html/names.ts`, `tests/engine/names.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T007`):

1. `npx vitest run tests/engine/names.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`friendlyName` and `layerKind` give every element the name and kind the Layers panel shows.

## Context

Engine module, HTML area. T008 (parsePage) calls both for every element. Pure functions.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/**
 * friendlyName(node): first match wins:
 * 1. attrs["data-mason-name"] (non-empty) as is; 2. tag "body" → "Page"; 3. classes[0] → humanize(classes[0]);
 * 4. attrs.id → humanize(id); 5. TAG_NAMES[tag] ?? humanize(tag).
 * humanize: split camelCase ("orderButton" → "order Button"), replace runs of "-" or "_" with one space,
 * lowercase, trim, uppercase the first letter. "hero-copy" → "Hero copy".
 */
export type FriendlyName = (node: { tag: string; attrs: Record<string, string>; classes: string[] }) => string;
export const TAG_NAMES: Record<string, string> = {
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading", p: "Text", span: "Text",
  a: "Link", button: "Button", img: "Image", picture: "Image", svg: "Vector", ul: "List", ol: "List", li: "List item",
  nav: "Navigation", header: "Header", footer: "Footer", main: "Main", section: "Section", article: "Article",
  aside: "Aside", div: "Frame", form: "Form", input: "Input", label: "Label", figure: "Figure", video: "Video",
};
/**
 * layerKind(node): img/picture/svg/video/canvas → "image"; a/button → "link"; body → "frame";
 * tag in TEXT_TAGS and every child tag in INLINE_TAGS → "text"; tag in CONTAINER_TAGS → "stack"; else "frame".
 */
export type LayerKindOf = (node: { tag: string; childTags: string[] }) => LayerKind;
export const TEXT_TAGS: readonly string[] = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "li", "blockquote", "figcaption", "small", "strong", "em", "code", "dt", "dd"];
export const INLINE_TAGS: readonly string[] = ["span", "em", "strong", "b", "i", "br", "small", "code", "a", "abbr", "mark", "sub", "sup", "time"];
export const CONTAINER_TAGS: readonly string[] = ["div", "section", "header", "footer", "main", "nav", "article", "aside", "ul", "ol", "form", "figure", "li"];
```

```ts
// src/contracts/model.ts
export type LayerKind = "frame" | "stack" | "text" | "image" | "link";
```

## Current state

`src/engine/html/` does not exist.

## Steps

1. Create `src/engine/html/names.ts` exporting three functions:
   - `humanize(value: string): string`: insert a space between a lowercase letter or digit and a following uppercase letter (`/([a-z0-9])([A-Z])/g` → `"$1 $2"`), replace every run of `-`, `_` or whitespace with one space, lowercase, trim, uppercase the first character.
   - `friendlyName(node: { tag: string; attrs: Record<string, string>; classes: string[] }): string` following the contract order exactly: `data-mason-name` (trimmed, non-empty) → `"Page"` for `body` → `humanize(classes[0])` → `humanize(attrs.id)` (when non-empty) → `TAG_NAMES[tag] ?? humanize(tag)`.
   - `layerKind(node: { tag: string; childTags: string[] }): LayerKind` following the contract order: image tags `img, picture, svg, video, canvas` → "image"; `a`, `button` → "link"; `body` → "frame"; tag in TEXT_TAGS and `childTags.every((t) => INLINE_TAGS.includes(t))` → "text"; tag in CONTAINER_TAGS → "stack"; else "frame".
   - Import TAG_NAMES, TEXT_TAGS, INLINE_TAGS, CONTAINER_TAGS as values from `../../contracts/engine.ts`.

2. Create `tests/engine/names.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { friendlyName, humanize, layerKind } from "../../src/engine/html/names.ts";
import type { FriendlyName, LayerKindOf } from "../../src/contracts/engine.ts";

const _t: [FriendlyName, LayerKindOf] = [friendlyName, layerKind];
void _t;
const n = (tag: string, attrs: Record<string, string> = {}, classes: string[] = []) => ({ tag, attrs, classes });

describe("names", () => {
  it("humanizes kebab, snake and camel case", () => {
    expect(humanize("hero-copy")).toBe("Hero copy");
    expect(humanize("order_button")).toBe("Order button");
    expect(humanize("orderButton")).toBe("Order button");
    expect(humanize("  site--header ")).toBe("Site header");
  });
  it("prefers data-mason-name, then body, then class, then id, then tag", () => {
    expect(friendlyName(n("div", { "data-mason-name": "Promo strip", id: "x" }, ["y"]))).toBe("Promo strip");
    expect(friendlyName(n("body", {}, ["page"]))).toBe("Page");
    expect(friendlyName(n("section", { id: "menu" }, ["this-week"]))).toBe("This week");
    expect(friendlyName(n("footer", { id: "visit" }))).toBe("Visit");
    expect(friendlyName(n("h2"))).toBe("Heading");
    expect(friendlyName(n("custom-el"))).toBe("Custom el");
  });
  it("classifies media, links and the body", () => {
    expect(layerKind({ tag: "img", childTags: [] })).toBe("image");
    expect(layerKind({ tag: "svg", childTags: ["path"] })).toBe("image");
    expect(layerKind({ tag: "a", childTags: ["span"] })).toBe("link");
    expect(layerKind({ tag: "button", childTags: [] })).toBe("link");
    expect(layerKind({ tag: "body", childTags: ["main"] })).toBe("frame");
  });
  it("classifies text elements only when every child is inline", () => {
    expect(layerKind({ tag: "h1", childTags: [] })).toBe("text");
    expect(layerKind({ tag: "p", childTags: ["em", "br", "a"] })).toBe("text");
    expect(layerKind({ tag: "li", childTags: ["h3", "p"] })).toBe("stack");
  });
  it("classifies containers as stacks and anything else as frames", () => {
    expect(layerKind({ tag: "section", childTags: ["div"] })).toBe("stack");
    expect(layerKind({ tag: "ul", childTags: ["li"] })).toBe("stack");
    expect(layerKind({ tag: "table", childTags: ["tr"] })).toBe("frame");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL humanize identifiers into sentence case. (test: "humanizes kebab, snake and camel case")
- THE SYSTEM SHALL name elements by data-mason-name, body, class, id, then tag. (test: "prefers data-mason-name, then body, then class, then id, then tag")
- THE SYSTEM SHALL classify layer kinds by tag and children. (test: "classifies text elements only when every child is inline")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T007`.
The last line must be `GATE PASS T007`. On `GATE FAIL T007 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T007` prints `GATE PASS T007`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T007: Implement friendly layer names and kinds
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
