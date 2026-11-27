# S004: Compose the mason command

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | S004 (seam), phase 2 |
| Depends on | T016, S003 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Seam | S004: shell -> cli (compose): startMason |
| Requirements | R13 |

**Create:** `src/cli/bin.ts`, `tests/cli/bin.test.ts`

**Modify:** none

**Read only:** `src/cli/args.ts`, `src/cli/open-browser.ts`, `src/server/start.ts`, `tests/helpers/http.ts`

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S004`):

1. `npx vitest run tests/cli/bin.test.ts` -> exit 0, output contains `Tests  2 passed (2)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`node src/cli/bin.ts [folder] [--port N] [--no-open] [--home DIR]` starts Mason through `startMason`, prints its URL and opens the browser.

## Context

Seam shell → cli (compose). `bin.ts` is the CLI's composition root: it joins the argument parser and browser opener (T016) to `startMason` (S003). Playwright smoke tests start the app through this command (see `playwright.config.ts`).

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
export interface StartOptions { port: number; project: string | null; homeDir: string | null; uiDir: string | null }
export interface RunningMason { url: string; port: number; studio: StudioService; close(): Promise<void> }
/** src/server/start.ts — composition root. homeDir null → MASON_HOME env var or ~/.mason; uiDir null → <repo>/dist/ui. */
export type StartMason = (options: StartOptions) => Promise<RunningMason>;
```

## Touch list

### src/cli/bin.ts (create)

The whole file is the composition; it is given in the steps.

### tests/cli/bin.test.ts (create)

Given in the steps.

## Steps

1. Create `src/cli/bin.ts` with exactly this content:

```ts
#!/usr/bin/env node
import { resolve } from "node:path";
import { parseCliArgs, HELP_TEXT } from "./args.ts";
import { openBrowser } from "./open-browser.ts";
import { startMason } from "../server/start.ts";

const args = parseCliArgs(process.argv.slice(2));
if (args.kind === "help") { process.stdout.write(HELP_TEXT); process.exit(0); }
if (args.kind === "error") { process.stderr.write(`${args.message}\n`); process.exit(2); }
if (args.kind === "run") {
  try {
    const running = await startMason({ port: args.port, project: args.project ? resolve(args.project) : null, homeDir: args.home ? resolve(args.home) : null, uiDir: null });
    console.log(`Mason is running at ${running.url}`);
    if (args.open) openBrowser(running.url);
    const stop = async () => { await running.close(); process.exit(0); };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
```

2. Create `tests/cli/bin.test.ts` with exactly this content:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rawRequest } from "../helpers/http.ts";

let child: ChildProcess | null = null;
const dirs: string[] = [];
afterEach(() => { child?.kill(); child = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("mason CLI", () => {
  it("starts, prints the URL and serves the project", async () => {
    const base = mkdtempSync(join(tmpdir(), "mason-cli-"));
    dirs.push(base);
    cpSync(join("tests", "fixtures", "northfield"), join(base, "north"), { recursive: true });
    child = spawn(process.execPath, ["src/cli/bin.ts", join(base, "north"), "--port", "0", "--no-open", "--home", join(base, "home")]);
    const url = await new Promise<string>((resolve, reject) => {
      let out = "";
      child!.stdout!.on("data", (c: Buffer) => { out += c.toString(); const m = out.match(/Mason is running at (http:\/\/127\.0\.0\.1:\d+\/)/); if (m) resolve(m[1]); });
      child!.on("exit", (code) => reject(new Error(`exited ${code}: ${out}`)));
    });
    const port = Number(new URL(url).port);
    const r = await rawRequest(port, "POST", "/api/rpc/currentProject", { body: "{}" });
    expect(JSON.parse(r.body).result.name).toBe("north");
  });
  it("prints help and exits 0", async () => {
    const code = await new Promise<number | null>((resolve) => {
      child = spawn(process.execPath, ["src/cli/bin.ts", "--help"]);
      child.on("exit", resolve);
    });
    expect(code).toBe(0);
  });
});
```

3. Run the gate (see Verify).

## Acceptance criteria

- WHEN the command starts THE SYSTEM SHALL print "Mason is running at <url>" and serve the project. (test: "starts, prints the URL and serves the project")
- WHEN --help is given THE SYSTEM SHALL print the usage and exit 0. (test: "prints help and exits 0")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S004`.
The last line must be `GATE PASS S004`. On `GATE FAIL S004 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.
If it prints `GATE FAIL S004 scope`, you changed a file outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.

## Done when

- `verify.ps1 -Card S004` prints `GATE PASS S004`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S004: Compose the mason command
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
