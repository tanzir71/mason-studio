# T008: Implement the HTML page parser

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T008 (build), phase 2 |
| Depends on | T007 |
| Effort | max |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R5 |

**Create:** `src/engine/html/parse.ts`, `tests/engine/parse-page.test.ts`

**Modify:** none

**Read only:** `src/engine/html/names.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T008`):

1. `npx vitest run tests/engine/parse-page.test.ts` -> exit 0, output contains `Tests  6 passed (6)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parsePage(file, text)` returns the page title, local stylesheets, the element tree with exact ranges, and a selector matcher by path.

## Context

Engine module, HTML area. Uses `friendlyName`/`layerKind` from T007 (`src/engine/html/names.ts`). The page group (T012), inspect (T040) and element edits (phase 5) all depend on these paths and ranges. The browser computes the same paths from `Element.children`.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
export interface PageModel {
  file: string;
  title: string;            // <title> text trimmed, or file name without ".html" when missing/empty
  /** href of every <link rel="stylesheet"> that is relative (no scheme, not "/" or "//"), "?"/"#" parts and a leading "./" removed. */
  stylesheets: string[];
  body: ElementNode;        // path ""
  /** css-select `is(node, selector)` for the element at path (exceptions → false); null if path is missing. */
  matcher(path: ElementPath): ElementMatcher | null;
}
/**
 * parsePage(file, text): parse5.parse(text, { treeAdapter: adapter (parse5-htmlparser2-tree-adapter),
 * sourceCodeLocationInfo: true }). ElementNode.range from sourceCodeLocation start/endOffset; innerRange from
 * startTag.endOffset to endTag.startOffset (null when there is no endTag). An implicit <body> gets range
 * [0, text.length] and innerRange null. name = friendlyName(...), kind = layerKind(...).
 */
export type ParsePage = (file: string, text: string) => PageModel;
```

```ts
// src/contracts/model.ts
/**
 * Element path: dot-separated indexes of ELEMENT children, starting at <body>.
 * "" is <body>; "0" is body's first element child; "0.2" is that element's third element child.
 * Every element child counts (script, style, template too). Text and comment nodes never count.
 * The browser (`Element.children`) and the server (parse5 element children) give identical paths.
 */
export type ElementPath = string;
export interface ElementNode {
  path: ElementPath;
  tag: string;                       // lowercase
  /** Only these attributes, when present: id, class, src, alt, href, data-mason-name. */
  attrs: Record<string, string>;
  classes: string[];                 // class attribute split on whitespace, empty strings removed
  name: string;                      // friendlyName(...)
  kind: LayerKind;                   // layerKind(...)
  /** Whitespace-collapsed, trimmed text content for kind "text" | "link"; cut to 80 chars + "…". Else null. */
  text: string | null;
  children: ElementNode[];
  range: SourceRange;                // whole element including start and end tag
  innerRange: SourceRange | null;    // from end of start tag to start of end tag; null for void elements
}
export interface ElementMatcher { matches(selector: string): boolean }
```

## Current state

`src/engine/html/names.ts` exports `friendlyName(node)`, `layerKind(node)` and `humanize(value)`. Installed: parse5 8.1.1, parse5-htmlparser2-tree-adapter 8.0.2 (exports `adapter`), css-select 7.0.0 (exports `is`), domhandler 6.0.1 (types `Element`, `Document`, `ChildNode`). The planner verified that `parse(text, { treeAdapter: adapter, sourceCodeLocationInfo: true })` gives each element `sourceCodeLocation.{startOffset, endOffset, startTag, endTag}`.

## Steps

1. Create `src/engine/html/parse.ts` following this skeleton; complete every `// TODO` exactly:
```ts
import { parse } from "parse5";
import { adapter } from "parse5-htmlparser2-tree-adapter";
import { is } from "css-select";
import type { ChildNode, Document, Element } from "domhandler";
import type { ElementMatcher, ElementNode, ElementPath } from "../../contracts/model.ts";
import type { PageModel } from "../../contracts/engine.ts";
import { friendlyName, layerKind } from "./names.ts";

const KEEP_ATTRS = ["id", "class", "src", "alt", "href", "data-mason-name"];
const isElement = (n: ChildNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";

function textOf(node: ChildNode): string {
  // TODO: concatenate the `data` of every descendant text node (type "text"), depth first.
}

export function parsePage(file: string, text: string): PageModel {
  const doc = parse(text, { treeAdapter: adapter, sourceCodeLocationInfo: true }) as unknown as Document;
  const byPath = new Map<ElementPath, Element>();
  // TODO: find <html>, then <head> and <body> (lowercase tag names) among element children.
  // TODO: title = trimmed text of <title> inside head; when empty use file without its ".html" suffix.
  // TODO: stylesheets = href of every <link> in head whose rel attribute split on whitespace contains
  //       "stylesheet", skipping hrefs that contain "://" or start with "/"; cut at the first "?" or "#";
  //       strip a leading "./".
  const build = (el: Element, path: ElementPath): ElementNode => {
    byPath.set(path, el);
    // TODO: children = element children only (isElement); child path = path === "" ? `${i}` : `${path}.${i}`.
    // TODO: attrs = KEEP_ATTRS present on el.attribs; classes = (attribs.class ?? "").split(/\s+/).filter(Boolean).
    // TODO: kind = layerKind({ tag, childTags }); name = friendlyName({ tag, attrs, classes }).
    // TODO: text for kind "text" | "link": textOf(el) with /\s+/g → " ", trimmed, cut to 80 chars + "…"; else null.
    // TODO: range from el.sourceCodeLocation (startOffset, endOffset); innerRange = endTag ?
    //       { start: startTag.endOffset, end: endTag.startOffset } : null.
    //       Without sourceCodeLocation (implicit body): range { start: 0, end: text.length }, innerRange null.
  };
  const body = build(/* TODO: the body element */, "");
  return {
    file, title, stylesheets, body,
    matcher(path: ElementPath): ElementMatcher | null {
      const el = byPath.get(path);
      if (!el) return null;
      return { matches: (selector: string) => { try { return is(el, selector); } catch { return false; } } };
    },
  };
}
```

2. Create `tests/engine/parse-page.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import type { ElementNode } from "../../src/contracts/model.ts";
import type { ParsePage } from "../../src/contracts/engine.ts";

const _t: ParsePage = parsePage;
void _t;
const html = readFileSync("tests/fixtures/northfield/index.html", "utf8");
const at = (body: ElementNode, path: string) => path.split(".").reduce((n, i) => n.children[Number(i)], body);

describe("parsePage", () => {
  it("reads the title and local stylesheets", () => {
    const page = parsePage("index.html", html);
    expect(page.title).toBe("Northfield Coffee");
    expect(page.stylesheets).toEqual(["tokens.css", "styles.css"]);
  });
  it("builds the element tree with paths, names and kinds", () => {
    const { body } = parsePage("index.html", html);
    expect(body).toMatchObject({ path: "", tag: "body", name: "Page", kind: "frame" });
    expect(body.children.map((c) => c.tag)).toEqual(["header", "main", "footer"]);
    expect(at(body, "1.0.0.1")).toMatchObject({ path: "1.0.0.1", tag: "h1", name: "Headline", kind: "text", classes: ["headline"], text: "Small-batch coffee, roasted down the street." });
    expect(at(body, "1.1")).toMatchObject({ name: "This week", kind: "stack", attrs: { class: "this-week", id: "menu" } });
    expect(at(body, "0.1.0")).toMatchObject({ tag: "a", name: "Link", kind: "link", text: "Menu", attrs: { href: "menu.html" } });
  });
  it("records element ranges and inner ranges", () => {
    const h1 = at(parsePage("index.html", html).body, "1.0.0.1");
    expect(html.slice(h1.range.start, h1.range.end)).toBe('<h1 class="headline">Small-batch coffee, roasted down the street.</h1>');
    expect(html.slice(h1.innerRange!.start, h1.innerRange!.end)).toBe("Small-batch coffee, roasted down the street.");
    const img = at(parsePage("index.html", html).body, "1.0.1");
    expect(img).toMatchObject({ kind: "image", innerRange: null, attrs: { alt: "The roaster at work", src: "images/roastery.svg", class: "hero-photo" } });
  });
  it("matches selectors against elements by path", () => {
    const page = parsePage("index.html", html);
    expect(page.matcher("1.0.0.1")!.matches(".hero h1")).toBe(true);
    expect(page.matcher("1.0.0.1")!.matches(".lede")).toBe(false);
    expect(page.matcher("1.0.0.1")!.matches("h1:hover")).toBe(false);
    expect(page.matcher("1.0.0.1")!.matches("((")).toBe(false);
    expect(page.matcher("9")).toBeNull();
  });
  it("keeps only relative stylesheets and falls back to the file name for the title", () => {
    const page = parsePage("about.html", '<html><head><link rel="stylesheet" href="./css/a.css?v=2"><link rel="stylesheet" href="https://x.y/b.css"><link rel="stylesheet" href="/c.css"><link rel="icon" href="d.css"></head><body><p>x</p></body></html>');
    expect(page.stylesheets).toEqual(["css/a.css"]);
    expect(page.title).toBe("about");
  });
  it("cuts long text to 80 characters plus an ellipsis", () => {
    const long = "word ".repeat(30).trim();
    const p = parsePage("a.html", `<body><p>${long}</p></body>`).body.children[0];
    expect(p.text).toBe(long.slice(0, 80) + "…");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL read the title and only relative stylesheet hrefs. (test: "reads the title and local stylesheets")
- THE SYSTEM SHALL build the element tree with paths, friendly names and kinds. (test: "builds the element tree with paths, names and kinds")
- THE SYSTEM SHALL record exact element and inner ranges. (test: "records element ranges and inner ranges")
- WHEN a selector is tested against a path THE SYSTEM SHALL use css-select and treat invalid selectors as no match. (test: "matches selectors against elements by path")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T008`.
The last line must be `GATE PASS T008`. On `GATE FAIL T008 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).
- Do not use a different HTML parser or tree adapter; paths must match the browser's parsing.

## Done when

- `verify.ps1 -Card T008` prints `GATE PASS T008`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T008: Implement the HTML page parser
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
