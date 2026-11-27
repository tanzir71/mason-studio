# T001: Bootstrap the toolchain

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T001 (skeleton), phase 1 |
| Depends on | none |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 60 turns, 3 fix attempts |

**Create:** `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `playwright.config.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, `tests/setup-dom.ts`, `tests/e2e/prepare.ts`, `tests/contracts.test.ts`

**Modify:** `.gitignore`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T001`):

1. `npm install --no-audit --no-fund` -> exit 0
2. `npx vitest run tests/contracts.test.ts` -> exit 0, output contains `Tests  14 passed (14)`
3. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The repo installs with `npm install`, type-checks the contracts, and `tests/contracts.test.ts` passes (14 tests).

## Context

First card. The planner already wrote `src/contracts/` (types, fakes, contract suites, tokens.css), `tests/fixtures/northfield/` (a sample site), `templates/` and `site/assets/`. This card adds the toolchain config verbatim. T002 adds module stubs. Every version below is pinned and was verified by the planner.

## Contracts (do not modify)

```ts
// src/contracts/ports.ts
/** Every StudioService method name, in declaration order. RPC and MCP accept only these. */
export const STUDIO_METHODS = [
  "openProject", "createProject", "currentProject", "recentProjects", "templates", "createPage", "pageTree",
  "inspect", "applyStyle", "resetStyle", "insertElement", "editText", "removeElement", "moveElement", "wrapInStack",
  "undo", "redo", "readFile", "writeFile", "tokens", "importTokens", "exportTokens", "checks", "gitStatus", "commit",
  "proposals", "propose", "acceptProposal", "rejectProposal", "askAgent", "settings", "saveSettings",
] as const satisfies readonly (keyof StudioService)[];
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

The repo has `src/contracts/`, `tests/fixtures/`, `templates/`, `site/assets/`, `handover/`, `AGENTS.md`, `CLAUDE.md` and this `.gitignore`:

```gitignore
# deepseek-handover run artifacts (logs, prompts)
handover/.run/
```

## Steps

1. Replace the whole content of `.gitignore` with exactly:

```gitignore
# deepseek-handover run artifacts (logs, prompts)
handover/.run/
node_modules/
dist/
release/
storybook-static/
test-results/
playwright-report/
tests/.tmp/
*.log
```

2. Create `package.json` with exactly this content:

```json
{
  "name": "mason-studio",
  "version": "0.1.0",
  "private": true,
  "description": "Open-source, local-first design canvas where boards are real HTML/CSS files.",
  "type": "module",
  "engines": { "node": ">=22.18" },
  "bin": { "mason": "src/cli/bin.ts" },
  "scripts": {
    "start": "node src/cli/bin.ts",
    "dev:ui": "vite",
    "build:ui": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "e2e": "node tests/e2e/prepare.ts && playwright test --project=chromium",
    "storybook": "storybook dev -p 6006",
    "build:storybook": "storybook build --quiet -o storybook-static"
  },
  "dependencies": {
    "@bramus/specificity": "2.4.5",
    "@codemirror/lang-css": "6.3.1",
    "@codemirror/lang-html": "6.4.12",
    "@codemirror/lang-json": "6.0.2",
    "@codemirror/language": "6.13.1",
    "@codemirror/state": "6.7.6",
    "@codemirror/view": "6.44.1",
    "@lezer/highlight": "1.2.5",
    "codemirror": "6.0.2",
    "css-select": "7.0.0",
    "domhandler": "6.0.1",
    "lucide-react": "1.81.0",
    "parse5": "8.1.1",
    "parse5-htmlparser2-tree-adapter": "8.0.2",
    "postcss": "8.5.33",
    "react": "19.3.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@playwright/test": "1.65.1",
    "@storybook/react-vite": "10.6.9",
    "@testing-library/dom": "10.4.2",
    "@testing-library/jest-dom": "8.0.0",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.13",
    "@types/node": "26.6.11",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.3.0",
    "esbuild": "0.28.2",
    "jsdom": "31.0.1",
    "storybook": "10.6.9",
    "typescript": "7.0.2",
    "vite": "8.4.0",
    "vitest": "5.1.2"
  }
}
```

3. Create `tsconfig.json` with exactly this content:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023", "dom", "dom.iterable"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "tests"],
  "exclude": ["tests/.tmp"]
}
```

4. Create `vitest.config.ts` with exactly this content:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/.tmp/**", "node_modules/**"],
    environment: "node",
    setupFiles: ["tests/setup-dom.ts"],
    testTimeout: 20000,
  },
});
```

5. Create `vite.config.ts` with exactly this content:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = "http://127.0.0.1:39765";

export default defineConfig({
  plugins: [react()],
  root: "src/ui",
  build: { outDir: "../../dist/ui", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": api, "/p/": api, "/mcp": api } },
});
```

6. Create `playwright.config.ts` with exactly this content:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  timeout: 30000,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:39799", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node src/cli/bin.ts tests/.tmp/northfield --port 39799 --no-open --home tests/.tmp/home",
    url: "http://127.0.0.1:39799/",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
```

7. Create `.storybook/main.ts` with exactly this content:

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/ui/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
};
export default config;
```

8. Create `.storybook/preview.ts` with exactly this content:

```ts
import type { Preview } from "@storybook/react-vite";
import "../src/ui/styles/global.css";

const preview: Preview = {
  parameters: { layout: "centered" },
};
export default preview;
```

9. Create `tests/setup-dom.ts` with exactly this content:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

10. Create `tests/e2e/prepare.ts` with exactly this content:

```ts
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Fresh copy of the fixture for Playwright, as its own Git repository so Git features have a known state. */
const tmp = join("tests", ".tmp");
const project = join(tmp, "northfield");
rmSync(tmp, { recursive: true, force: true });
cpSync(join("tests", "fixtures", "northfield"), project, { recursive: true });
mkdirSync(join(tmp, "home"), { recursive: true });
const git = (...args: string[]) => execFileSync("git", args, { cwd: project, stdio: "ignore" });
git("init", "-q");
git("config", "user.name", "Mason Test");
git("config", "user.email", "test@example.com");
console.log("prepared tests/.tmp/northfield");
```

11. Do not run `npm install` yourself: the first verify command runs it and creates `package-lock.json` and `node_modules/`.

12. Create `tests/contracts.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { runFileSystemContract } from "../src/contracts/file-system.contract.ts";
import { runSettingsStoreContract } from "../src/contracts/settings-store.contract.ts";
import { InMemoryFileSystem, MemorySettingsStore, createFakeStudio, normalizeProjectPath } from "../src/contracts/fakes.ts";
import { createFakeStore } from "../src/contracts/fakes-ui.ts";
import { STUDIO_METHODS } from "../src/contracts/ports.ts";
import { MasonError, isMasonError } from "../src/contracts/errors.ts";

runFileSystemContract("in-memory fake", async () => ({ fs: new InMemoryFileSystem(), cleanup: async () => {} }));
runSettingsStoreContract("memory fake", async () => ({ store: new MemorySettingsStore(), cleanup: async () => {} }));

describe("contracts", () => {
  it("lists all 32 studio methods and the fake rejects them", async () => {
    expect(STUDIO_METHODS.length).toBe(32);
    await expect(createFakeStudio().templates()).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
  it("builds MasonError messages from the code and detail", () => {
    const e = new MasonError("FILE_NOT_FOUND", "a.css");
    expect(e.message).toBe("File not found. a.css");
    expect(isMasonError(e)).toBe(true);
    expect(isMasonError(new Error("x"))).toBe(false);
  });
  it("normalizes project paths", () => {
    expect(normalizeProjectPath("./css\\a.css")).toBe("css/a.css");
    expect(() => normalizeProjectPath("../a")).toThrow("Path is outside the project folder.");
  });
  it("records fake store actions", async () => {
    const store = createFakeStore({ page: "Home" });
    await store.actions.selectPage("Menu");
    expect(store.calls).toEqual([{ name: "selectPage", args: ["Menu"] }]);
    expect(store.getState().page).toBe("Home");
  });
});
```

13. Run the gate (see Verify).

## Acceptance criteria

- WHEN `npm install` runs THE SYSTEM SHALL install every pinned package and write `package-lock.json`. (verify 1)
- WHEN the contract suites run against the fakes THE SYSTEM SHALL pass all 14 tests. (test: "lists all 32 studio methods and the fake rejects them")
- THE SYSTEM SHALL type-check `src/` and `tests/` with zero errors. (verify 3)

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T001`.
The last line must be `GATE PASS T001`. On `GATE FAIL T001 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not change any version number or add a caret (`^`) to a version.

## Done when

- `verify.ps1 -Card T001` prints `GATE PASS T001`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T001: Bootstrap the toolchain
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
