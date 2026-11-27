# T087: Build the landing page shell and hero

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T087 (build), phase 11 |
| Depends on | C1 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R37 |

**Create:** `site/styles.css`, `site/index.html`, `tests/site/site-hero.test.ts`

**Modify:** none

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T087`):

1. `npx vitest run tests/site/site-hero.test.ts` -> exit 0, output contains `Tests  3 passed (3)`
2. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

`site/index.html` and `site/styles.css` show the navigation, the hero with the app screenshot and the three captions.

## Context

Site module (`site/`): the public landing page from Figma "Mason" → 03 Landing. Plain HTML and CSS with no build step and no JavaScript, so the page is itself a Mason project (open `site/` in Mason to edit it). `site/assets/` (screenshot and logo) is planner-owned and already exists. Later cards insert sections directly above the `<!-- sections -->` line and append CSS to the end of `styles.css`.

## Contracts (do not modify)

This card uses no contract types. Assets: `site/assets/app-canvas.png` (1440×900) and `site/assets/mason-mark.svg`.

## Current state

`site/` contains only `assets/`.

## Steps

1. Create `site/styles.css` with exactly this content:

```css
/* Mason landing page. Plain CSS, no build step. Opens in Mason itself: it is a normal Mason project. */
:root {
  --ink: #151513; --ink-soft: #34332f; --muted: #6b6961; --faint: #9a978d;
  --paper: #f5f3ee; --paper-deep: #ecebe5; --panel: #ffffff; --line: #e3e0d8;
  --night: #121211; --night-panel: #1a1a18; --night-line: #2c2b28; --night-text: #d3d1ca; --night-muted: #99978e;
  --accent: #2f5fe8; --tablet: #0f8a7c; --mobile: #c2387f; --ok: #2e8b5e; --bad: #d23f35; --rust: #b4532a;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --radius: 12px;
  --wrap: 1120px;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 15px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
img { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
code, pre { font-family: var(--mono); }
.wrap { width: min(var(--wrap), calc(100% - 48px)); margin: 0 auto; }
.eyebrow { margin: 0 0 12px; font-size: 12px; color: var(--muted); }
.lede { margin: 0; font-size: 16px; color: var(--ink-soft); }
h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.02em; }
h1 { font-size: 72px; line-height: 1.02; letter-spacing: -0.035em; }
h2 { font-size: 40px; line-height: 1.1; }
h3 { font-size: 15px; letter-spacing: 0; }

/* Navigation */
.nav { position: sticky; top: 0; z-index: 10; background: rgba(245, 243, 238, 0.92); backdrop-filter: blur(8px); border-bottom: 1px solid transparent; }
.nav__inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; text-decoration: none; }
.brand img { width: 24px; height: 24px; }
.nav__links { display: flex; align-items: center; gap: 28px; margin: 0; padding: 0; list-style: none; font-size: 14px; color: var(--ink-soft); }
.nav__links a { text-decoration: none; }
.nav__links a:hover { color: var(--ink); }

/* Buttons */
.button { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font: 500 14px/1 var(--font); text-decoration: none; cursor: pointer; }
.button:hover { border-color: var(--faint); }
.button--dark { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.button--dark:hover { background: var(--ink-soft); }
.button--small { height: 30px; padding: 0 12px; font-size: 13px; }

/* Hero */
.hero { padding: 72px 0 0; }
.pill { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; padding: 5px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); font-size: 13px; color: var(--ink-soft); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
.hero h1 { max-width: 560px; }
.hero .lede { max-width: 620px; margin-top: 24px; }
.hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 32px; }
.hero__note { font-size: 13px; color: var(--faint); }
.shot { margin-top: 56px; overflow: hidden; border-radius: 14px; box-shadow: 0 30px 80px rgba(20, 20, 15, 0.18), 0 0 0 1px rgba(20, 20, 15, 0.08); }
.captions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin: 0; padding: 32px 0 96px; list-style: none; }
.captions__title { margin-bottom: 4px; font-size: 15px; letter-spacing: 0; }
.captions p { margin: 0; font-size: 14px; color: var(--muted); }

@media (max-width: 900px) {
  h1 { font-size: 52px; }
  h2 { font-size: 32px; }
  .nav__links li:not(:last-child) { display: none; }
  .captions { grid-template-columns: 1fr; gap: 20px; }
}
@media (max-width: 480px) {
  h1 { font-size: 40px; }
  h2 { font-size: 28px; }
  .wrap { width: calc(100% - 32px); }
  .hero { padding-top: 40px; }
}
```

2. Create `site/index.html` with exactly this content:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mason: design on real web pages</title>
  <meta name="description" content="Mason is an open-source design canvas for people who ship websites. Your boards are your HTML and CSS files.">
  <link rel="icon" href="assets/mason-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="nav">
    <div class="wrap nav__inner">
      <a class="brand" href="#top"><img src="assets/mason-mark.svg" alt="" width="24" height="24">Mason</a>
      <nav aria-label="Main">
        <ul class="nav__links">
          <li><a href="#files">How it works</a></li>
          <li><a href="#agents">Agents</a></li>
          <li><a href="#penpot">Penpot users</a></li>
          <li><a href="https://github.com/tanzir71/mason#readme">Docs</a></li>
          <li><a href="https://github.com/tanzir71/mason">GitHub</a></li>
          <li><a class="button button--dark button--small" href="#download">Download</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="top">
    <section class="hero">
      <div class="wrap">
        <span class="pill"><span class="dot"></span>Open source · local-first · no account</span>
        <h1>Design on real web pages.</h1>
        <p class="lede">Mason is a design canvas for people who ship websites. Your boards are your HTML and CSS files, breakpoints sit side by side as real media queries, and any coding agent can work on the canvas with you.</p>
        <div class="hero__actions">
          <a class="button button--dark" href="#download">Download for macOS</a>
          <a class="button" href="https://github.com/tanzir71/mason">View on GitHub</a>
          <span class="hero__note">Windows and Linux in beta</span>
        </div>
        <img class="shot" src="assets/app-canvas.png" width="1440" height="900" alt="Mason with the Northfield site open: Home and Menu pages at Desktop, Tablet and Mobile, the headline selected and the Design panel set to tablet sizes.">
        <ul class="captions">
          <li><h2 class="captions__title">Boards</h2><p>Every page at Desktop, Tablet and Mobile, side by side.</p></li>
          <li><h2 class="captions__title">Applies to</h2><p>Choose where a change lands. Mason writes the right @media rule.</p></li>
          <li><h2 class="captions__title">Files</h2><p>Saved to styles.css. Undo, or commit with Git.</p></li>
        </ul>
      </div>
    </section>
    <!-- sections -->
  </main>
</body>
</html>
```

3. Create `tests/site/site-hero.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";

const html = readFileSync("site/index.html", "utf8");

describe("landing page shell", () => {
  it("is a plain page Mason can open, linking styles.css", () => {
    const page = parsePage("index.html", html);
    expect(page.title).toBe("Mason: design on real web pages");
    expect(page.stylesheets).toEqual(["styles.css"]);
    expect(() => parseStylesheet("styles.css", readFileSync("site/styles.css", "utf8"))).not.toThrow();
  });
  it("has the navigation, hero and download links", () => {
    expect(html).toContain('<h1>Design on real web pages.</h1>');
    expect(html).toContain("Open source · local-first · no account");
    expect(html).toContain('<a class="button button--dark" href="#download">Download for macOS</a>');
    expect(html).toContain('src="assets/app-canvas.png"');
    expect(html).toContain("<!-- sections -->");
  });
  it("gives the screenshot a description", () => {
    const img = /<img class="shot"[^>]*alt="([^"]+)"/.exec(html);
    expect(img?.[1].length).toBeGreaterThan(40);
  });
});
```

4. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL be a page Mason can open, linking only styles.css. (test: "is a plain page Mason can open, linking styles.css")
- THE SYSTEM SHALL show the hero, the download link and the app screenshot with alt text. (test: "has the navigation, hero and download links")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T087`.
The last line must be `GATE PASS T087`. On `GATE FAIL T087 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

## Do NOT

- Do not edit contract files (`src/contracts/*`), fixtures (`tests/fixtures/*`), templates (`templates/*`), `site/assets/*` or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit `package.json` / `package-lock.json`.
- Do not delete, skip (`.skip`, `.only`, `todo`) or weaken any test; do not edit test files this card did not create.
- Use `import type` for type-only imports; keep the `.ts` / `.tsx` extension on every relative import.
- Do not import from other modules; this card works inside `site/` and uses only the contracts (fakes only in tests).
- Do not add JavaScript, web fonts, frameworks or a build step to the site.
- Do not use italics (`<i>`, `<em>`, `font-style: italic`), gradients or `!important` anywhere on the site.
- Do not change copy, links, class names or ids from the code given.

## Done when

- `verify.ps1 -Card T087` prints `GATE PASS T087`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T087: Build the landing page shell and hero
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
