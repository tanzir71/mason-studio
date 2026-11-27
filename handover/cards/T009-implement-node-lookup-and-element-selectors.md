# T009: Implement node lookup and element selectors

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T009 (build), phase 2 |
| Depends on | T008 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R5 |

**Create:** `src/engine/html/select.ts`, `tests/engine/select.test.ts`

**Modify:** none

**Read only:** `src/engine/html/parse.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T009`):

1. `npx vitest run tests/engine/select.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`findNode`, `elementSelector` and `nextClassName` work on any parsed page tree.

## Context

Engine module, HTML area. Inspect (T040) shows `elementSelector`; write-back (T037) uses it for new rules; inserts (T048) use `nextClassName`.

## Contracts (do not modify)

```ts
// src/contracts/engine.ts
/** findNode(body, path): the node at path, or null. */
export type FindNode = (body: ElementNode, path: ElementPath) => ElementNode | null;
/**
 * elementSelector(body, path): `#${id}` when the node has an id; else "." + classes.join(".") when it has
 * classes; else the nearest ancestor below body with an id (`#${id} ${tag}`) or a class (`.${classes[0]} ${tag}`);
 * else "body > " + tags from body's child down to the node joined with " > ". Throws ELEMENT_NOT_FOUND.
 */
export type ElementSelector = (body: ElementNode, path: ElementPath) => string;
/** nextClassName(body, prefix): `${prefix}-${n}` with the smallest n >= 1 not used as a class anywhere in the tree. */
export type NextClassName = (body: ElementNode, prefix: string) => string;
```

## Current state

`src/engine/html/parse.ts` (T008) exports `parsePage`. Each `ElementNode` has `path`, `tag`, `attrs`, `classes` and `children`.

## Steps

1. Create `src/engine/html/select.ts` exporting:
   - `findNode(body, path)`: "" → body; else walk `path.split(".")`, taking `children[Number(segment)]`; any missing step → null.
   - `elementSelector(body, path)`: node = findNode or throw `new MasonError("ELEMENT_NOT_FOUND", path)`. Return `#${attrs.id}` when `attrs.id` is non-empty; else `"." + classes.join(".")` when classes exist; else walk ancestors from the parent upward, stopping before body (path ""): the first with an id gives `#${id} ${node.tag}`, the first with classes gives `.${classes[0]} ${node.tag}`; else `"body > " + tags of the nodes from body's child down to the node joined with " > "`. Ancestor of path `a.b.c` = `a.b`, then `a`.
   - `nextClassName(body, prefix)`: collect every class in the tree; return `${prefix}-${n}` for the smallest n >= 1 not in the set.

2. Create `tests/engine/select.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { elementSelector, findNode, nextClassName } from "../../src/engine/html/select.ts";
import type { ElementSelector, FindNode, NextClassName } from "../../src/contracts/engine.ts";

const _t: [FindNode, ElementSelector, NextClassName] = [findNode, elementSelector, nextClassName];
void _t;
const { body } = parsePage("index.html", readFileSync("tests/fixtures/northfield/index.html", "utf8"));

describe("select helpers", () => {
  it("finds nodes by path", () => {
    expect(findNode(body, "")?.tag).toBe("body");
    expect(findNode(body, "1.0.0.1")?.tag).toBe("h1");
    expect(findNode(body, "1.9")).toBeNull();
  });
  it("uses the id, then the classes", () => {
    expect(elementSelector(body, "1.1")).toBe("#menu");
    expect(elementSelector(body, "1.0.0.1")).toBe(".headline");
    expect(elementSelector(body, "1.1.1.0")).toBe(".card");
  });
  it("falls back to the nearest named ancestor, then to a tag chain", () => {
    expect(elementSelector(body, "1.1.0")).toBe("#menu h2");
    expect(elementSelector(body, "0.1.0")).toBe(".nav a");
    expect(elementSelector(body, "1")).toBe("body > main");
  });
  it("throws ELEMENT_NOT_FOUND for a missing path", () => {
    expect(() => elementSelector(body, "7")).toThrow("Element not found.");
  });
  it("picks the next free class name", () => {
    expect(nextClassName(body, "frame")).toBe("frame-1");
    const two = parsePage("a.html", '<body><div class="frame-1"></div><p class="frame-3"></p></body>').body;
    expect(nextClassName(two, "frame")).toBe("frame-2");
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL find nodes by element path. (test: "finds nodes by path")
- THE SYSTEM SHALL build selectors from id, classes, named ancestors or the tag chain. (test: "falls back to the nearest named ancestor, then to a tag chain")
- IF the path does not exist THEN THE SYSTEM SHALL throw ELEMENT_NOT_FOUND. (test: "throws ELEMENT_NOT_FOUND for a missing path")
- THE SYSTEM SHALL pick the smallest free `<prefix>-n` class. (test: "picks the next free class name")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T009`.
The last line must be `GATE PASS T009`. On `GATE FAIL T009 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/engine/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T009` prints `GATE PASS T009`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T009: Implement node lookup and element selectors
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
