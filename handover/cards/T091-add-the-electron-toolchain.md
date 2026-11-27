# T091: Add the Electron toolchain

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T091 (build), phase 12 |
| Depends on | C10 |
| Effort | low |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R38 |

**Create:** `electron-builder.yml`, `tests/desktop/package.test.ts`

**Modify:** `package.json`, `package-lock.json`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T091`):

1. `npm install --no-audit --no-fund` -> exit 0
2. `npx vitest run tests/desktop/package.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
3. `npx electron --version` -> exit 0, output contains `v45.5.0`
4. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

Electron 45.5.0 and electron-builder 26.18.0 are installed as dev dependencies, package.json points `main` at the desktop bundle, and the desktop scripts and packaging config exist.

## Context

Desktop module (`src/desktop/`): an Electron 45 shell around the same local server and UI. The renderer is the normal web UI loaded from `http://127.0.0.1:<port>/`; the only native addition is a folder picker exposed as `window.masonDesktop` (see MasonDesktopBridge). Main and preload are bundled with esbuild into `dist/desktop/` (gitignored). This is the only card that edits package.json after T001; it changes exactly the lines shown. Packages are built without asar so the bundled server reads `templates/` as plain files.

## Contracts (do not modify)

This card uses no contract types.

## Current state

`package.json` is the T001 file. `electron-builder.yml` does not exist.

## Steps

1. Replace the whole content of `package.json` with exactly:

```json
{
  "name": "mason-studio",
  "version": "0.1.0",
  "private": true,
  "description": "Open-source, local-first design canvas where boards are real HTML/CSS files.",
  "type": "module",
  "main": "dist/desktop/main.mjs",
  "engines": {
    "node": ">=22.18"
  },
  "bin": {
    "mason": "src/cli/bin.ts"
  },
  "scripts": {
    "start": "node src/cli/bin.ts",
    "dev:ui": "vite",
    "build:ui": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "e2e": "node tests/e2e/prepare.ts && playwright test --project=chromium",
    "storybook": "storybook dev -p 6006",
    "build:storybook": "storybook build --quiet -o storybook-static",
    "desktop:build": "node src/desktop/build.ts",
    "desktop": "vite build && node src/desktop/build.ts && electron .",
    "desktop:dist": "vite build && node src/desktop/build.ts && electron-builder"
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
    "electron": "45.5.0",
    "electron-builder": "26.18.0",
    "esbuild": "0.28.2",
    "jsdom": "31.0.1",
    "storybook": "10.6.9",
    "typescript": "7.0.2",
    "vite": "8.4.0",
    "vitest": "5.1.2"
  }
}
```

2. Create `electron-builder.yml` with exactly this content:

```
# Desktop packages for Mason. Build with: npm run desktop:dist
appId: dev.mason.app
productName: Mason
directories:
  output: release
files:
  - dist/**
  - templates/**
  - package.json
  - "!dist/desktop/*.map"
asar: false
mac:
  category: public.app-category.developer-tools
  target: [dmg]
win:
  target: [nsis]
linux:
  category: Development
  target: [AppImage, deb]
```

3. Create `tests/desktop/package.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const builder = readFileSync("electron-builder.yml", "utf8");

describe("desktop packaging setup", () => {
  it("pins Electron and electron-builder and points main at the bundle", () => {
    expect(pkg.devDependencies.electron).toBe("45.5.0");
    expect(pkg.devDependencies["electron-builder"]).toBe("26.18.0");
    expect(pkg.dependencies.electron).toBeUndefined();
    expect(pkg.main).toBe("dist/desktop/main.mjs");
  });
  it("adds the desktop scripts", () => {
    expect(pkg.scripts["desktop:build"]).toBe("node src/desktop/build.ts");
    expect(pkg.scripts.desktop).toBe("vite build && node src/desktop/build.ts && electron .");
    expect(pkg.scripts["desktop:dist"]).toBe("vite build && node src/desktop/build.ts && electron-builder");
  });
  it("packages dist and templates without asar", () => {
    expect(builder).toContain("appId: dev.mason.app");
    expect(builder).toContain("  - templates/**");
    expect(builder).toContain("asar: false");
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL pin electron 45.5.0 and electron-builder 26.18.0 as dev dependencies with main = dist/desktop/main.mjs. (test: "pins Electron and electron-builder and points main at the bundle")
- THE SYSTEM SHALL package dist and templates without asar. (test: "packages dist and templates without asar")
- WHEN `npx electron --version` runs THE SYSTEM SHALL print v45.5.0 (verify: electron version command).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T091`.
The last line must be `GATE PASS T091`. On `GATE FAIL T091 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not change any dependency or version other than adding electron 45.5.0 and electron-builder 26.18.0 to devDependencies; never use a caret (^).
- Do not run npm yourself; the first verify command installs the new packages and updates package-lock.json.
- Do not import from other modules; this card works inside `src/desktop/` and uses only the contracts (fakes only in tests).

## Done when

- `verify.ps1 -Card T091` prints `GATE PASS T091`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T091: Add the Electron toolchain
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
