# T003: Implement the Node file system

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T003 (build), phase 2 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R1 |

**Create:** `tests/infra/node-fs.test.ts`

**Modify:** `src/server/infra/node-fs.ts`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T003`):

1. `npx vitest run tests/infra/node-fs.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`createNodeFileSystem(root)` reads and writes real project files with the contract's path rules.

## Context

Infra module. Replaces the T002 stub. S001 then runs the shared FileSystem contract suite against it. The engine only ever sees the `FileSystem` port.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/**
 * Files of one project, rooted at `root`. Paths are project-relative with "/" separators.
 * Paths that are absolute or escape the root ("..") → MasonError("PATH_OUTSIDE_PROJECT").
 */
export interface FileSystem {
  readonly root: string;
  readText(path: string): Promise<string>;          // missing → FILE_NOT_FOUND (detail = path)
  writeText(path: string, text: string): Promise<void>; // creates parent folders
  readBytes(path: string): Promise<Uint8Array>;      // missing → FILE_NOT_FOUND
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Files (not folders) under dir ("" = root), recursive, relative to root, sorted; skips ".git" and "node_modules". */
  list(dir: string): Promise<string[]>;
}
/** src/server/infra/node-fs.ts */
export type CreateNodeFileSystem = (root: string) => FileSystem;
```

```ts
// src/contracts/errors.ts
/** message = ERROR_MESSAGES[code], or `${ERROR_MESSAGES[code]} ${detail}` when detail is given. */
export class MasonError extends Error {
  readonly code: MasonErrorCode;
  readonly detail: string | null;
  constructor(code: MasonErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code]);
    this.name = "MasonError";
    this.code = code;
    this.detail = detail ?? null;
  }
}
```

## Current state

`src/server/infra/node-fs.ts` is a stub that throws `new MasonError("NOT_IMPLEMENTED", "createNodeFileSystem")`.

## Steps

1. Replace the whole content of `src/server/infra/node-fs.ts` with this implementation, completing every `// TODO` exactly as its comment says:

```ts
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { MasonError } from "../../contracts/errors.ts";
import type { CreateNodeFileSystem, FileSystem } from "../../contracts/ports.ts";

/** "\\" → "/", drop "" and "." segments, ".." pops a segment; absolute paths or escaping ".." → PATH_OUTSIDE_PROJECT. */
export function normalizeRelative(path: string): string {
  const p = path.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) throw new MasonError("PATH_OUTSIDE_PROJECT", path);
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) throw new MasonError("PATH_OUTSIDE_PROJECT", path);
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

const SKIP = new Set([".git", "node_modules"]);

export const createNodeFileSystem: CreateNodeFileSystem = (root: string): FileSystem => {
  const base = resolve(root);
  const abs = (path: string) => join(base, normalizeRelative(path));
  return {
    root: base,
    async readText(path) { /* TODO: return (await this.readBytes(path)) decoded as UTF-8 with new TextDecoder() */ },
    async writeText(path, text) { /* TODO: await this.writeBytes(path, new TextEncoder().encode(text)) */ },
    async readBytes(path) {
      // TODO: return new Uint8Array(await readFile(abs(path))); when the error code is "ENOENT" or "EISDIR"
      //       throw new MasonError("FILE_NOT_FOUND", normalizeRelative(path)); rethrow anything else.
    },
    async writeBytes(path, data) { /* TODO: mkdir(dirname(abs(path)), { recursive: true }) then writeFile(abs(path), data) */ },
    async exists(path) { /* TODO: try { await stat(abs(path)); return true } catch { return false } */ },
    async list(dir) {
      // TODO: walk abs(dir) recursively with readdir(..., { withFileTypes: true }); skip entries named in SKIP;
      //       collect files as root-relative paths with "/" separators; return them sorted; a missing dir → [].
    },
  };
};
```

2. Create `tests/infra/node-fs.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createNodeFileSystem } from "../../src/server/infra/node-fs.ts";

describe("createNodeFileSystem", () => {
  it("exposes the resolved root", () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    expect(createNodeFileSystem(dir).root).toBe(resolve(dir));
    rmSync(dir, { recursive: true, force: true });
  });
  it("writes real files under the root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    await createNodeFileSystem(dir).writeText("css/a.css", "a{}");
    expect(readFileSync(join(dir, "css", "a.css"), "utf8")).toBe("a{}");
    rmSync(dir, { recursive: true, force: true });
  });
  it("lists a missing folder as an empty array", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mason-fs-"));
    expect(await createNodeFileSystem(dir).list("nothing-here")).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL expose `root` as the resolved absolute folder. (test: "exposes the resolved root")
- WHEN writeText is called with a nested path THE SYSTEM SHALL create the folders and the file on disk. (test: "writes real files under the root")
- WHEN list is called on a missing folder THE SYSTEM SHALL return []. (test: "lists a missing folder as an empty array")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T003`.
The last line must be `GATE PASS T003`. On `GATE FAIL T003 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/server/infra/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T003` prints `GATE PASS T003`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T003: Implement the Node file system
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
