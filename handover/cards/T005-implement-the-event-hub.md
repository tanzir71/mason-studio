# T005: Implement the event hub

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T005 (build), phase 2 |
| Depends on | C1 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R3 |

**Create:** `tests/infra/events.test.ts`

**Modify:** `src/server/infra/events.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T005`):

1. `npx vitest run tests/infra/events.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createEventHub()` delivers every emitted MasonEvent to current subscribers in subscribe order.

## Context

Infra module. Replaces the T002 stub. The studio emits through it (S003) and the HTTP events route streams it to the browser (T015).

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface EventSink { emit(event: MasonEvent): void }
/** In-process pub/sub. subscribe returns an unsubscribe function; listeners run synchronously in subscribe order. */
export interface EventHub extends EventSink { subscribe(listener: (event: MasonEvent) => void): () => void }
/** src/server/infra/events.ts */
export type CreateEventHub = () => EventHub;
```

```ts
// src/contracts/model.ts
export type MasonEvent =
  | { type: "written"; files: string[]; revision: number }
```

## Current state

`src/server/infra/events.ts` is a stub that throws NOT_IMPLEMENTED.

## Steps

1. Replace the whole content of `src/server/infra/events.ts` with `export const createEventHub: CreateEventHub = () => { ... }` returning `{ emit, subscribe }`:
   - keep listeners in an array; `subscribe(l)` appends and returns a function that removes exactly that listener;
   - `emit(e)` calls every listener of a copy of the array, in order; if a listener throws, catch the error and continue with the next listener.

2. Create `tests/infra/events.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { createEventHub } from "../../src/server/infra/events.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

const ev: MasonEvent = { type: "external-change", files: ["a.css"] };

describe("createEventHub", () => {
  it("delivers events to subscribers in order", () => {
    const hub = createEventHub();
    const seen: string[] = [];
    hub.subscribe(() => seen.push("first"));
    hub.subscribe(() => seen.push("second"));
    hub.emit(ev);
    expect(seen).toEqual(["first", "second"]);
  });
  it("stops delivering after unsubscribe", () => {
    const hub = createEventHub();
    const seen: MasonEvent[] = [];
    const off = hub.subscribe((e) => seen.push(e));
    off();
    hub.emit(ev);
    expect(seen).toEqual([]);
  });
  it("keeps delivering when a listener throws", () => {
    const hub = createEventHub();
    const seen: MasonEvent[] = [];
    hub.subscribe(() => { throw new Error("boom"); });
    hub.subscribe((e) => seen.push(e));
    hub.emit(ev);
    expect(seen).toEqual([ev]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN an event is emitted THE SYSTEM SHALL call subscribers in subscribe order. (test: "delivers events to subscribers in order")
- WHEN a listener unsubscribes THE SYSTEM SHALL stop calling it. (test: "stops delivering after unsubscribe")
- IF a listener throws THEN THE SYSTEM SHALL still call the remaining listeners. (test: "keeps delivering when a listener throws")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T005`.
The last line must be `GATE PASS T005`. On `GATE FAIL T005 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T005` prints `GATE PASS T005`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T005: Implement the event hub
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
