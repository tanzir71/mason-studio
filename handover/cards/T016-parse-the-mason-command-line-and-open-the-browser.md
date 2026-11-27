# T016: Parse the mason command line and open the browser

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T016 (build), phase 2 |
| Depends on | C1 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R13 |

**Create:** `src/cli/args.ts`, `src/cli/open-browser.ts`, `tests/cli/args.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T016`):

1. `npx vitest run tests/cli/args.test.ts` -> exit 0, output contains `Tests  5 passed (5)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`parseCliArgs(argv)` understands `[folder] [--port N] [--no-open] [--home DIR]` and `openBrowser(url)` opens the system browser.

## Context

CLI module (`src/cli/`). The executable `bin.ts` that calls `startMason` is composed by seam S004; this card only builds the two helpers it uses.

## Contracts (do not modify)

```ts
// src/contracts/http.ts
export const DEFAULT_PORT = 39765;
```

## Current state

`src/cli/` does not exist.

## Steps

1. Create `src/cli/args.ts` exporting `HELP_TEXT` (exactly `"Usage: mason [folder] [--port <number>] [--no-open] [--home <dir>]\n\nOpens Mason on http://127.0.0.1:<port>/ (default port 39765).\n"`), the type `CliArgs` and `parseCliArgs(argv: string[]): CliArgs`, where `CliArgs` is `{ kind: "run"; project: string | null; port: number; open: boolean; home: string | null } | { kind: "help" } | { kind: "error"; message: string }`:
   - defaults: project null, port DEFAULT_PORT, open true, home null;
   - read argv left to right: `-h`/`--help` → return help at once; `--no-open` → open false; `--port <v>` → integer 0..65535, else return error `"--port needs a number from 0 to 65535"`; `--home <dir>` → home; any other value starting with `-` → error `` `Unknown option: ${arg}` ``; a bare value → project (a second one → error `"Only one folder can be opened"`).

2. Create `src/cli/open-browser.ts` exporting `openBrowser(url: string): void`: `spawn` from `node:child_process` with `{ detached: true, stdio: "ignore" }`, then `child.unref()`: on win32 run `cmd` with `["/c", "start", "", url]`; on darwin `open` with `[url]`; otherwise `xdg-open` with `[url]`. Attach `child.on("error", () => {})` so a missing opener never crashes Mason.

3. Create `tests/cli/args.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { parseCliArgs, HELP_TEXT } from "../../src/cli/args.ts";

describe("parseCliArgs", () => {
  it("uses defaults with no arguments", () => {
    expect(parseCliArgs([])).toEqual({ kind: "run", project: null, port: 39765, open: true, home: null });
  });
  it("reads a folder, --port, --no-open and --home in any order", () => {
    expect(parseCliArgs(["--no-open", "site", "--port", "4000", "--home", "h"])).toEqual({ kind: "run", project: "site", port: 4000, open: false, home: "h" });
  });
  it("returns help for -h and --help", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ kind: "help" });
    expect(HELP_TEXT.startsWith("Usage: mason [folder]")).toBe(true);
  });
  it("rejects a bad port and unknown flags", () => {
    expect(parseCliArgs(["--port", "x"])).toEqual({ kind: "error", message: "--port needs a number from 0 to 65535" });
    expect(parseCliArgs(["--wat"])).toEqual({ kind: "error", message: "Unknown option: --wat" });
  });
  it("rejects a second folder", () => {
    expect(parseCliArgs(["a", "b"])).toEqual({ kind: "error", message: "Only one folder can be opened" });
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL parse the folder, --port, --no-open and --home flags with defaults. (test: "reads a folder, --port, --no-open and --home in any order")
- IF a flag is unknown or the port is invalid THEN THE SYSTEM SHALL return an error message. (test: "rejects a bad port and unknown flags")
- WHEN two folders are given THE SYSTEM SHALL return "Only one folder can be opened". (test: "rejects a second folder")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T016`.
The last line must be `GATE PASS T016`. On `GATE FAIL T016 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `src/cli/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T016` prints `GATE PASS T016`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T016: Parse the mason command line and open the browser
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
