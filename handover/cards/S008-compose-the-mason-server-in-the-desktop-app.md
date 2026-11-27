# S008: Compose the Mason server in the desktop app

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S008 (seam), phase 12 |
| Depends on | T093, S007 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S008: shell -> desktop (compose): startMason |
| Requirements | R38 |

**Create:** none

**Modify:** `src/desktop/main.ts`

**Read only:** `src/server/start.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S008`):

1. `npx tsc --noEmit -p tsconfig.json` -> exit 0
2. `npx vite build` -> exit 0, output contains `built in`
3. `node src/desktop/build.ts` -> exit 0, output contains `built dist/desktop`
4. `npx electron dist/desktop/main.mjs --smoke` -> exit 0, output contains `MASON SMOKE OK`
<!-- END GENERATED SCOPE -->

## Goal

The desktop app starts the real Mason server on a free port with its settings in the user's app-data folder, and `--smoke` proves it end to end.

## Context

Seam shell → desktop (compose). `startMason` (src/server/start.ts) is the same composition root the CLI uses; the desktop passes `port: 0`, `homeDir: app.getPath("userData")` and the UI build next to the bundle (`dist/ui`). The smoke run needs a desktop session (Windows or macOS; on Linux use `xvfb-run`).

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface StartOptions { port: number; project: string | null; homeDir: string | null; uiDir: string | null }
export interface RunningMason { url: string; port: number; studio: StudioService; close(): Promise<void> }
/** src/server/start.ts — composition root. homeDir null → MASON_HOME env var or ~/.mason; uiDir null → <repo>/dist/ui. */
export type StartMason = (options: StartOptions) => Promise<RunningMason>;
```

## Touch list

### src/desktop/main.ts (modify)

Anchor: `// @seam:imports`. Insert directly above it:

```ts
import { startMason } from "../server/start.ts";
```

Anchor: `  // @seam:compose-desktop`. Insert directly above it:

```ts
  return startMason({ port: 0, project, homeDir: app.getPath("userData"), uiDir: join(here, "..", "ui") });
```

Before:

```ts
  void project;
  // @seam:compose-desktop
  throw new Error("The Mason server is not composed yet.");
```

After:

```ts
  void project;
  return startMason({ port: 0, project, homeDir: app.getPath("userData"), uiDir: join(here, "..", "ui") });
  // @seam:compose-desktop
  throw new Error("The Mason server is not composed yet.");
```

The `throw` line becomes unreachable; leave it.

## Steps

1. Apply both insertions of the touch list to `src/desktop/main.ts`.

2. Run the gate (see Verify).

## Acceptance criteria

- WHEN `npx electron dist/desktop/main.mjs --smoke` runs THE SYSTEM SHALL start the server, answer one RPC and print MASON SMOKE OK (verify: electron smoke command).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S008`.
The last line must be `GATE PASS S008`. On `GATE FAIL S008 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S008 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S008` prints `GATE PASS S008`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S008: Compose the Mason server in the desktop app
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
