# T024: Map element paths to DOM elements in a board

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T024 (build), phase 3 |
| Depends on | C1 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R15 |

**Create:** `src/ui/canvas/dom-paths.ts`, `tests/ui/dom-paths.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T024`):

1. `npx vitest run tests/ui/dom-paths.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`elementAtPath`, `pathOf` and `boxOf` translate between element paths and elements inside a board iframe.

## Context

UI module, canvas area. Boards are same-origin iframes of `/p/<page>`. The server computes paths from parse5 element children; the browser must give identical paths from `Element.children` (see ElementPath).

## Contracts (do not modify)

```ts
// src/contracts/model.ts
/**
 * Element path: dot-separated indexes of ELEMENT children, starting at <body>.
 * "" is <body>; "0" is body's first element child; "0.2" is that element's third element child.
 * Every element child counts (script, style, template too). Text and comment nodes never count.
 * The browser (`Element.children`) and the server (parse5 element children) give identical paths.
 */
export type ElementPath = string;
```

## Current state

`src/ui/canvas/` does not exist.

## Steps

1. Create `src/ui/canvas/dom-paths.ts` with exactly this content:

```ts
import type { ElementPath } from "../../contracts/model.ts";

/** The element at `path` inside doc.body ("" = body), using Element.children indexes; null when missing. */
export function elementAtPath(doc: Document, path: ElementPath): Element | null {
  let el: Element | null = doc.body;
  if (!el || path === "") return el;
  for (const seg of path.split(".")) {
    el = el.children[Number(seg)] ?? null;
    if (!el) return null;
  }
  return el;
}

/** Path of `el` relative to its document's body; "" for body; null when el is not inside body. */
export function pathOf(el: Element | null): ElementPath | null {
  const body = el?.ownerDocument.body;
  if (!el || !body) return null;
  const segs: number[] = [];
  let cur: Element = el;
  while (cur !== body) {
    const parent: Element | null = cur.parentElement;
    if (!parent) return null;
    segs.unshift(Array.prototype.indexOf.call(parent.children, cur));
    cur = parent;
  }
  return segs.join(".");
}

export interface Box { x: number; y: number; width: number; height: number }
/** Rounded box of `el` in its document's viewport pixels (getBoundingClientRect). */
export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
}
```

2. Create `tests/ui/dom-paths.test.ts` with exactly this content:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { boxOf, elementAtPath, pathOf } from "../../src/ui/canvas/dom-paths.ts";

const doc = new DOMParser().parseFromString("<html><body><header><a>x</a><nav><a>y</a></nav></header><main></main><script></script></body></html>", "text/html");

describe("dom paths", () => {
  it("finds elements by path", () => {
    expect(elementAtPath(doc, "")).toBe(doc.body);
    expect(elementAtPath(doc, "0.1.0")!.textContent).toBe("y");
    expect(elementAtPath(doc, "2")!.tagName).toBe("SCRIPT");
    expect(elementAtPath(doc, "0.5")).toBeNull();
  });
  it("computes the path of an element", () => {
    expect(pathOf(doc.body)).toBe("");
    expect(pathOf(doc.querySelector("nav a"))).toBe("0.1.0");
    expect(pathOf(doc.querySelector("main"))).toBe("1");
    expect(pathOf(doc.documentElement)).toBeNull();
    expect(pathOf(null)).toBeNull();
  });
  it("rounds the bounding box", () => {
    const el = doc.querySelector("main")!;
    el.getBoundingClientRect = () => ({ left: 10.4, top: 20.6, width: 99.5, height: 40.2 } as DOMRect);
    expect(boxOf(el)).toEqual({ x: 10, y: 21, width: 100, height: 40 });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL find elements by path from body, counting every element child. (test: "finds elements by path")
- THE SYSTEM SHALL compute an element's path, and null outside body. (test: "computes the path of an element")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T024`.
The last line must be `GATE PASS T024`. On `GATE FAIL T024 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/ui/app, components, canvas, panels, styles` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T024` prints `GATE PASS T024`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T024: Map element paths to DOM elements in a board
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
