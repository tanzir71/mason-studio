# S001: Prove the Node file system against the FileSystem contract

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S001 (seam), phase 2 |
| Depends on | T003, T010 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S001: infra -> engine (contract-test): createNodeFileSystem |
| Requirements | R1 |

**Create:** `tests/integration/node-fs.contract.test.ts`

**Modify:** none

**Read only:** `src/server/infra/node-fs.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S001`):

1. `npx vitest run tests/integration/node-fs.contract.test.ts` -> exit 0, output contains `Tests  7 passed (7)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The shared FileSystem contract suite passes against `createNodeFileSystem` on real temp folders.

## Context

Seam infra → engine (contract-test). T003 built the implementation; the engine (T010 opens projects through it) consumes the `FileSystem` port through `StudioDeps.openFs`, composed later in S003.

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
```

```ts
// src/contracts/file-system.contract.ts (protected; 7 tests)
export function runFileSystemContract(label: string, make: () => Promise<{ fs: FileSystem; cleanup(): Promise<void> }>): void;
```

## Touch list

### tests/integration/node-fs.contract.test.ts (create)

The complete file is given in the steps.

## Steps

1. Create `tests/integration/node-fs.contract.test.ts` with exactly this content:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFileSystemContract } from "../../src/contracts/file-system.contract.ts";
import { createNodeFileSystem } from "../../src/server/infra/node-fs.ts";

runFileSystemContract("node", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mason-contract-"));
  return { fs: createNodeFileSystem(dir), cleanup: async () => rmSync(dir, { recursive: true, force: true }) };
});
```

2. Run the gate (see Verify).

## Acceptance criteria

- WHEN the FileSystem contract suite runs against createNodeFileSystem THE SYSTEM SHALL pass all 7 tests. (test: "writes and reads text, creating parent folders")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S001`.
The last line must be `GATE PASS S001`. On `GATE FAIL S001 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S001 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S001` prints `GATE PASS S001`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S001: Prove the Node file system against the FileSystem contract
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
