# T086: Watch the project folder for outside changes

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T086 (build), phase 10 |
| Depends on | T005 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R36 |

**Create:** `tests/infra/watcher.test.ts`

**Modify:** `src/server/infra/watcher.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T086`):

1. `npx vitest run tests/infra/watcher.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createProjectWatcher(events)` reports files changed by other programs as one debounced external-change event; `suppressOwnWrites(hub)` hides Mason's own saves.

## Context

Infra module. Replaces the T002 stub. When a person edits a file in their code editor, boards reload within a moment. Node 22 supports `fs.watch(..., { recursive: true })` on Windows, macOS and Linux.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface EventSink { emit(event: MasonEvent): void }
/** In-process pub/sub. subscribe returns an unsubscribe function; listeners run synchronously in subscribe order. */
export interface EventHub extends EventSink { subscribe(listener: (event: MasonEvent) => void): () => void }
/** src/server/infra/watcher.ts — fs.watch(root, { recursive: true }); emits { type: "external-change", files } debounced 150 ms, ignoring .git/ and node_modules/. */
export interface ProjectWatcher { watch(root: string): void; close(): void }
export type CreateProjectWatcher = (events: EventSink) => ProjectWatcher;
```

## Current state

`src/server/infra/watcher.ts` is a stub that throws NOT_IMPLEMENTED.

## Steps

1. Replace the whole content of `src/server/infra/watcher.ts` with exactly:

```ts
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import type { MasonEvent } from "../../contracts/model.ts";
import type { CreateProjectWatcher, EventHub, EventSink } from "../../contracts/ports.ts";

export const DEBOUNCE_MS = 150;
const IGNORED = /(^|\/)(\.git|node_modules)(\/|$)/;

/**
 * fs.watch(root, { recursive: true }); file names ("\\" → "/") outside .git/ and node_modules/ are collected and
 * emitted as one { type: "external-change", files } (sorted, unique) 150 ms after the last change. watch() replaces
 * the previous watch; close() stops it and drops pending changes.
 */
export const createProjectWatcher: CreateProjectWatcher = (events: EventSink) => {
  let watcher: FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = new Set<string>();
  const stop = () => {
    watcher?.close();
    watcher = null;
    if (timer) clearTimeout(timer);
    timer = null;
    pending = new Set();
  };
  return {
    watch(root: string) {
      stop();
      watcher = watch(root, { recursive: true }, (_event, name) => {
        if (!name) return;
        const file = String(name).replace(/\\/g, "/");
        if (IGNORED.test(file)) return;
        pending.add(file);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const files = [...pending].sort();
          pending = new Set();
          timer = null;
          events.emit({ type: "external-change", files });
        }, DEBOUNCE_MS);
      });
      watcher.on("error", () => stop());
    },
    close: stop,
  };
};

/**
 * An EventSink in front of `hub` that drops external-change files Mason itself wrote (a "written" event within
 * `windowMs`), so Mason's own saves do not reload the boards twice. Other events pass through unchanged.
 */
export function suppressOwnWrites(hub: EventHub, windowMs = 1000, now: () => number = Date.now): EventSink {
  const written = new Map<string, number>();
  hub.subscribe((e: MasonEvent) => {
    if (e.type === "written") for (const f of e.files) written.set(f, now());
  });
  return {
    emit(e: MasonEvent) {
      if (e.type !== "external-change") { hub.emit(e); return; }
      const files = e.files.filter((f) => { const t = written.get(f); return t === undefined || now() - t > windowMs; });
      if (files.length > 0) hub.emit({ type: "external-change", files });
    },
  };
}
```

2. Create `tests/infra/watcher.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectWatcher, suppressOwnWrites } from "../../src/server/infra/watcher.ts";
import { MemoryEventHub } from "../../src/contracts/fakes.ts";
import type { MasonEvent } from "../../src/contracts/model.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createProjectWatcher", () => {
  it("emits one debounced external-change with sorted files, ignoring .git", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-watch-"));
    mkdirSync(join(dir, "css"));
    mkdirSync(join(dir, ".git"));
    const hub = new MemoryEventHub();
    const watcher = createProjectWatcher(hub);
    watcher.watch(dir);
    await wait(100);
    writeFileSync(join(dir, "styles.css"), "a{}");
    writeFileSync(join(dir, "css", "b.css"), "b{}");
    writeFileSync(join(dir, ".git", "index"), "x");
    await wait(700);
    watcher.close();
    expect(hub.emitted).toEqual([{ type: "external-change", files: ["css/b.css", "styles.css"] }]);
    rmSync(dir, { recursive: true, force: true });
  });
  it("stops after close", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-watch-"));
    const hub = new MemoryEventHub();
    const watcher = createProjectWatcher(hub);
    watcher.watch(dir);
    watcher.close();
    writeFileSync(join(dir, "a.css"), "a{}");
    await wait(400);
    expect(hub.emitted).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("suppressOwnWrites", () => {
  it("drops files Mason wrote within the window and passes the rest", () => {
    let t = 0;
    const hub = new MemoryEventHub();
    const sink = suppressOwnWrites(hub, 1000, () => t);
    hub.emit({ type: "written", files: ["styles.css"], revision: 1 });
    t = 500;
    sink.emit({ type: "external-change", files: ["styles.css"] });
    sink.emit({ type: "external-change", files: ["index.html", "styles.css"] });
    t = 2000;
    sink.emit({ type: "external-change", files: ["styles.css"] });
    const external = hub.emitted.filter((e: MasonEvent) => e.type === "external-change");
    expect(external).toEqual([{ type: "external-change", files: ["index.html"] }, { type: "external-change", files: ["styles.css"] }]);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN files change THE SYSTEM SHALL emit one external-change with sorted paths 150 ms after the last change, ignoring .git and node_modules. (test: "emits one debounced external-change with sorted files, ignoring .git")
- THE SYSTEM SHALL drop files Mason wrote in the last second. (test: "drops files Mason wrote within the window and passes the rest")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T086`.
The last line must be `GATE PASS T086`. On `GATE FAIL T086 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T086` prints `GATE PASS T086`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T086: Watch the project folder for outside changes
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
