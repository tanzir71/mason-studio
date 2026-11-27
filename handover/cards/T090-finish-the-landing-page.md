# T090: Finish the landing page

<!-- BEGIN GENERATED SCOPE -->
| Field | Value |
|---|---|
| Card | T090 (build), phase 11 |
| Depends on | T089, T066 |
| Effort | high |
| Budget | 3 non-test files, ~300 changed lines, 40 turns, 3 fix attempts |
| Requirements | R37 |

**Create:** `tests/e2e/site.spec.ts`, `tests/site/site-complete.test.ts`

**Modify:** `site/index.html`, `site/styles.css`

**Read only:** none

**Forbidden:** every contract file (`src/contracts/model.ts`, `src/contracts/errors.ts`, `src/contracts/engine.ts`, `src/contracts/ports.ts`, `src/contracts/http.ts`, `src/contracts/mcp.ts`, `src/contracts/ui.tsx`), everything under `handover/` except PROGRESS.md and BLOCKED.md.

**Verify** (run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T090`):

1. `npx vitest run tests/site/site-complete.test.ts` -> exit 0, output contains `Tests  4 passed (4)`
2. `npx vitest run tests/site/site-hero.test.ts tests/site/site-sections.test.ts tests/site/site-agents.test.ts` -> exit 0, output contains `Tests  7 passed (7)`
3. `node tests/e2e/prepare.ts` -> exit 0, output contains `prepared tests/.tmp/northfield`
4. `npx vite build` -> exit 0, output contains `built in`
5. `npx playwright test site.spec.ts --project=chromium` -> exit 0, output contains `4 passed`, output does not contain `failed`
6. `npx tsc --noEmit -p tsconfig.json` -> exit 0
<!-- END GENERATED SCOPE -->

## Goal

The landing page ends with the privacy band, the Get Mason download card and the footer, passes Mason's own structure checks and fits 1440, 768 and 375px screens.

## Context

Site module (`site/`): the public landing page from Figma "Mason" → 03 Landing. Plain HTML and CSS with no build step and no JavaScript, so the page is itself a Mason project (open `site/` in Mason to edit it). `site/assets/` (screenshot and logo) is planner-owned and already exists. The tests run Mason's own engine checks on the page. The Playwright spec opens the page from disk (file://), so it needs no server, but Playwright still starts the configured web server, so the gate builds the UI first.

## Contracts (do not modify)

This card uses no contract types.

## Current state

`site/index.html` ends with:

```html
    <!-- sections -->
  </main>
</body>
</html>
```

## Steps

1. In `site/index.html` replace the two lines `    <!-- sections -->` and `  </main>` with exactly the following (the marker stays, then the last sections, `</main>` and the footer):

```html
    <!-- sections -->
    <section class="band band--deep privacy">
      <div class="wrap">
        <h2 class="privacy__title">No account. No server.<br>No telemetry.</h2>
        <p class="lede privacy__lede">Mason opens straight to your files and sends nothing anywhere until you connect an agent. Pair it with Ollama and the whole loop, design to AI edit, runs on your laptop.</p>
      </div>
    </section>
    <section class="band" id="download">
      <div class="wrap">
        <div class="card get">
          <div class="get__intro">
            <h2>Get Mason</h2>
            <p>Free and open source. Nothing to sign up for. Your projects stay plain folders you can open anywhere.</p>
            <a class="get__sponsor" href="https://github.com/sponsors/tanzir71">Sponsor development</a>
          </div>
          <ul class="get__list">
            <li><div><h3>macOS</h3><p>Apple silicon and Intel · signed</p></div><a class="button button--dark button--small" href="https://github.com/tanzir71/mason/releases/latest">Download</a></li>
            <li><div><h3>Windows</h3><p>Beta · x64 and ARM</p></div><a class="button button--small" href="https://github.com/tanzir71/mason/releases/latest">Download</a></li>
            <li><div><h3>Linux</h3><p>Beta · AppImage and .deb</p></div><a class="button button--small" href="https://github.com/tanzir71/mason/releases/latest">Download</a></li>
            <li class="get__source"><div><h3>From source</h3><code>git clone https://github.com/tanzir71/mason</code></div></li>
          </ul>
        </div>
      </div>
    </section>
  </main>
  <footer class="footer">
    <div class="wrap footer__inner">
      <div class="footer__row">
        <a class="brand" href="#top"><img src="assets/mason-mark.svg" alt="" width="24" height="24">Mason</a>
        <span class="footer__tag">Design on real web pages.</span>
        <ul class="footer__links">
          <li><a href="https://github.com/tanzir71/mason">GitHub</a></li>
          <li><a href="https://github.com/tanzir71/mason#readme">Docs</a></li>
          <li><a href="https://github.com/tanzir71/mason/releases">Changelog</a></li>
          <li><a href="https://github.com/tanzir71/mason/blob/main/LICENSE">Licence</a></li>
          <li><a href="https://github.com/sponsors/tanzir71">Sponsor</a></li>
        </ul>
      </div>
      <div class="footer__row footer__row--small">
        <span>Built by <a href="https://tanziro.com">tanziro.com</a></span>
        <span>Open source · 2026</span>
      </div>
    </div>
  </footer>
```

2. Append exactly these lines to the end of `site/styles.css`:

```css
/* Sections: privacy, download, footer */
.privacy { padding: 120px 0; }
.privacy__title { max-width: 820px; font-size: 56px; line-height: 1.05; letter-spacing: -0.03em; }
.privacy__lede { max-width: 560px; margin-top: 24px; }
.get { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); }
.get__intro { padding: 40px; border-right: 1px solid var(--line); }
.get__intro h2 { font-size: 40px; }
.get__intro p { margin: 16px 0 24px; color: var(--muted); }
.get__sponsor { font-size: 13px; text-decoration: none; }
.get__sponsor::before { content: "♡"; margin-right: 6px; }
.get__list { margin: 0; padding: 12px 32px; list-style: none; }
.get__list li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.get__list li:last-child { border-bottom: 0; }
.get__list h3 { font-size: 16px; }
.get__list p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
.get__source code { display: inline-block; margin-top: 8px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); font-size: 12px; overflow-wrap: anywhere; }
.footer { border-top: 1px solid var(--line); padding: 32px 0 40px; font-size: 13px; }
.footer__inner { display: grid; gap: 20px; }
.footer__row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.footer__tag { color: var(--muted); }
.footer__links { display: flex; flex-wrap: wrap; gap: 20px; margin: 0 0 0 auto; padding: 0; list-style: none; }
.footer__links a { text-decoration: none; color: var(--ink-soft); }
.footer__row--small { justify-content: space-between; font-size: 12px; color: var(--faint); }
@media (max-width: 900px) {
  .privacy__title { font-size: 40px; }
  .get { grid-template-columns: minmax(0, 1fr); }
  .get__intro { border-right: 0; border-bottom: 1px solid var(--line); }
}
@media (max-width: 480px) {
  .privacy { padding: 72px 0; }
  .privacy__title { font-size: 32px; }
  .get__intro, .get__list { padding-left: 20px; padding-right: 20px; }
  .footer__links { margin-left: 0; }
}
```

3. Create `tests/e2e/site.spec.ts` with exactly this content:

```ts
import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const url = "file://" + resolve("site/index.html");

for (const width of [1440, 768, 375]) {
  test(`landing page fits a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: "Design on real web pages." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await expect(page.locator("img.shot")).toHaveJSProperty("complete", true);
    expect(await page.locator("img.shot").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1440);
  });
}

test("the download button scrolls to the download card", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("link", { name: "Download for macOS" }).click();
  await expect(page.getByRole("heading", { name: "Get Mason" })).toBeInViewport();
});
```

4. Create `tests/site/site-complete.test.ts` with exactly this content:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePage } from "../../src/engine/html/parse.ts";
import { parseStylesheet } from "../../src/engine/css/parse.ts";
import { checkPageStructure } from "../../src/engine/checks/structure.ts";
import { checkBans, parseTaste } from "../../src/engine/checks/taste.ts";

const html = readFileSync("site/index.html", "utf8");
const css = readFileSync("site/styles.css", "utf8");

describe("finished landing page", () => {
  it("passes Mason's own structure checks", () => {
    expect(checkPageStructure(parsePage("index.html", html).body)).toEqual({ findings: [], passed: ["Headings in order", "Images have alt text"] });
  });
  it("has every in-page link target", () => {
    const targets = [...html.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
    for (const id of new Set(targets)) expect(html).toContain(`id="${id}"`);
    for (const id of ["files", "responsive", "agents", "penpot", "download"]) expect(html).toContain(`id="${id}"`);
  });
  it("ends with the download card and footer", () => {
    expect(html).toContain("<h2>Get Mason</h2>");
    expect(html).toContain('<h2 class="privacy__title">No account. No server.<br>No telemetry.</h2>');
    expect(html.trimEnd().endsWith("</footer>\n</body>\n</html>")).toBe(true);
  });
  it("follows the design rules: no italics, gradients or !important", () => {
    const sheet = parseStylesheet("styles.css", css);
    expect(sheet.rules.length).toBeGreaterThan(100);
    const taste = parseTaste("## Hard bans\n- literal: italic | No italics\n- literal: linear-gradient | No gradients\n- literal: !important | No !important\n");
    expect(checkBans(taste, css, { file: "styles.css", line: null, path: null })).toEqual([]);
    expect(html).not.toMatch(/<(i|em)>/);
  });
});
```

5. Run the gate (see Verify).

## Acceptance criteria

- THE SYSTEM SHALL pass Mason's heading and alt-text checks. (test: "passes Mason's own structure checks")
- THE SYSTEM SHALL have a target for every in-page link. (test: "has every in-page link target")
- THE SYSTEM SHALL contain no italics, gradients or !important. (test: "follows the design rules: no italics, gradients or !important")
- THE SYSTEM SHALL not scroll sideways at 1440, 768 or 375px wide (verify: Playwright site.spec.ts).

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T090`.
The last line must be `GATE PASS T090`. On `GATE FAIL T090 <step>`, open the log the gate names under `handover/.run/logs/`, fix inside your files only, and run the gate again.

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

- `verify.ps1 -Card T090` prints `GATE PASS T090`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T090: Finish the landing page
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
